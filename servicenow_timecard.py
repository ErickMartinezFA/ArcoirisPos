"""
ServiceNow Timecard Automation Script
======================================
Reads weekly timecard data from Excel and creates TC/TW records in ServiceNow.
Auth: Microsoft SSO via Playwright browser login.
Zero manual configuration — file picker, auto column detection, auto week date.
"""

import os
import sys
import time
import re
from datetime import date, timedelta
from itertools import groupby
from pathlib import Path

import requests
import openpyxl
from playwright.sync_api import sync_playwright

# ─────────────────────────────────────────────
# FIXED CONSTANTS (never need editing)
# ─────────────────────────────────────────────

SERVICENOW_URL  = "https://simplified.service-now.com"
TIMECARD_FOLDER = r"C:\Syntax\Syntax Daily\Time entry\2026"

DAYS = ["tuesday", "wednesday", "thursday", "friday", "saturday"]

DAY_OFFSETS = {
    "tuesday":   0,
    "wednesday": 1,
    "thursday":  2,
    "friday":    3,
    "saturday":  4,
}

# Keywords used to match each logical column in the header row.
# Order matters — first match wins. All comparisons are case-insensitive substrings.
COLUMN_KEYWORDS = {
    "ticket":      ["ticket", "incidente", "incident", "número", "numero", "tarea", "task", "ref"],
    "company":     ["company", "compañia", "compania", "customer", "cliente", "empresa"],
    "sc":          ["service commitment", "commitment", "compromiso", "soc", " sc"],
    "description": ["description", "descripcion", "remarks", "remark", "comment", "comentario", "notas", "notes", "detalle"],
    "tuesday":     ["tuesday", "martes"],
    "wednesday":   ["wednesday", "miercoles", "miércoles"],
    "thursday":    ["thursday", "jueves"],
    "friday":      ["friday", "viernes"],
    "saturday":    ["saturday", "sabado", "sábado"],
}

# Month abbreviations used when parsing date-style headers like "23-Jun" or "Jun-23"
_MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,  "may": 5,  "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "ene": 1, "abr": 4, "ago": 8, "dic": 12,
}

# ─────────────────────────────────────────────
# STEP 1 — AUTO-SELECT LATEST EXCEL FILE
# ─────────────────────────────────────────────

def pick_excel_file() -> str:
    """Returns the most recently modified Excel file in TIMECARD_FOLDER."""
    folder = Path(TIMECARD_FOLDER)
    if not folder.exists():
        print(f"[ERROR] Timecard folder not found: {TIMECARD_FOLDER}")
        sys.exit(1)

    candidates = [
        p for p in folder.rglob("*")
        if p.suffix.lower() in (".xlsx", ".xlsm", ".xls") and not p.name.startswith("~$")
    ]

    if not candidates:
        print(f"[ERROR] No Excel files found in {TIMECARD_FOLDER}")
        sys.exit(1)

    latest = max(candidates, key=lambda p: p.stat().st_mtime)
    print(f"[FILE] Auto-selected (most recently modified): {latest}")
    return str(latest)


# ─────────────────────────────────────────────
# STEP 2 — COLUMN AUTO-DETECTION
# ─────────────────────────────────────────────

def _cell_text(cell) -> str:
    """Returns stripped lowercase string value of a cell, or ''."""
    if cell is None or cell.value is None:
        return ""
    return str(cell.value).strip().lower()


def _parse_date_header(cell, week_tuesday: date) -> str | None:
    """
    Tries to interpret a cell as a date and returns the matching DAYS key
    ('tuesday'–'saturday') if it falls within the configured week, else None.
    Handles:
      - Excel date types (datetime / date objects from openpyxl)
      - Strings: 23-Jun, Jun-23, 6/23, 23/6, 2026-06-23, 23-06-2026, etc.
    """
    from datetime import datetime as dt

    cell_date: date | None = None

    # openpyxl returns datetime or date objects for date-formatted cells
    if hasattr(cell.value, "month"):
        try:
            cell_date = cell.value.date() if hasattr(cell.value, "date") else cell.value
        except Exception:
            pass

    if cell_date is None:
        text = _cell_text(cell)
        if not text:
            return None

        # Patterns to try, in order
        patterns = [
            # ISO: 2026-06-23
            (r"(\d{4})-(\d{1,2})-(\d{1,2})", lambda m: date(int(m[1]), int(m[2]), int(m[3]))),
            # 23-06-2026 or 23/06/2026
            (r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", lambda m: date(int(m[3]), int(m[2]), int(m[1]))),
            # 23-Jun or Jun-23
            (r"(\d{1,2})[-\s]([a-z]{3})", lambda m: _abbr_to_date(int(m[1]), m[2], week_tuesday.year)),
            (r"([a-z]{3})[-\s](\d{1,2})", lambda m: _abbr_to_date(int(m[2]), m[1], week_tuesday.year)),
            # 6/23 or 23/6  (month/day or day/month — try both, keep whichever lands in week)
            (r"^(\d{1,2})[/](\d{1,2})$", lambda m: _ambiguous_slash(int(m[1]), int(m[2]), week_tuesday)),
        ]

        for pattern, builder in patterns:
            m = re.search(pattern, text)
            if m:
                try:
                    cell_date = builder(m)
                    if cell_date:
                        break
                except Exception:
                    continue

    if cell_date is None:
        return None

    # Map to a DAYS key if within this week (Tue–Sat)
    for day, offset in DAY_OFFSETS.items():
        if cell_date == week_tuesday + timedelta(days=offset):
            return day

    return None


def _abbr_to_date(day_num: int, month_abbr: str, year: int) -> date | None:
    month = _MONTH_ABBR.get(month_abbr[:3].lower())
    if month is None:
        return None
    return date(year, month, day_num)


def _ambiguous_slash(a: int, b: int, week_tuesday: date) -> date | None:
    """Try a/b as month/day and b/a as day/month; return whichever matches the week."""
    week_dates = {week_tuesday + timedelta(days=o) for o in DAY_OFFSETS.values()}
    for month, day in [(a, b), (b, a)]:
        try:
            d = date(week_tuesday.year, month, day)
            if d in week_dates:
                return d
        except ValueError:
            pass
    return None


def detect_columns(filepath: str, week_tuesday: date) -> tuple[dict, int]:
    """
    Scans the first 10 rows looking for the best header row.
    Matches both keyword-based and date-based column headers.
    Returns (col_map, header_row_index).
    """
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb[wb.sheetnames[0]]

    best_row_idx = 0
    best_col_map: dict[str, int] = {}
    best_score = 0

    rows = list(ws.iter_rows(min_row=1, max_row=10))

    for row_idx, row in enumerate(rows):
        col_map: dict[str, int] = {}

        for col_idx, cell in enumerate(row):
            # 1. Try date-based match first (covers date-formatted cells & strings like "23-Jun")
            day_key = _parse_date_header(cell, week_tuesday)
            if day_key and day_key not in col_map:
                col_map[day_key] = col_idx
                continue

            # 2. Fall back to keyword match
            text = _cell_text(cell)
            if not text:
                continue
            for logical, keywords in COLUMN_KEYWORDS.items():
                if logical in col_map:
                    continue
                if any(kw in text for kw in keywords):
                    col_map[logical] = col_idx
                    break

        score = sum(2 if k in DAYS else 1 for k in col_map)
        if score > best_score:
            best_score = score
            best_col_map = col_map
            best_row_idx = row_idx

    return best_col_map, best_row_idx


def _idx_to_letter(idx: int) -> str:
    result = ""
    n = idx + 1
    while n:
        n, r = divmod(n - 1, 26)
        result = chr(65 + r) + result
    return result


def _letter_to_idx(letter: str) -> int:
    letter = letter.upper().strip()
    result = 0
    for ch in letter:
        result = result * 26 + (ord(ch) - 64)
    return result - 1


def _print_col_map(col_map: dict, header_row_idx: int) -> None:
    header_rows = header_row_idx + 1
    print(f"\n[COLUMNS] Detected header on row {header_row_idx + 1}  →  data starts on row {header_rows + 1}")
    all_logical = ["ticket", "company", "sc", "description"] + DAYS
    required = set(DAYS)
    for logical in all_logical:
        if logical in col_map:
            letter = _idx_to_letter(col_map[logical])
            tag = " (required)" if logical in required else ""
            print(f"  {logical:<12} → column {letter}{tag}")
        else:
            tag = " (REQUIRED — missing!)" if logical in required else " (optional, not found)"
            print(f"  {logical:<12} → NOT FOUND{tag}")
    print()


def confirm_columns(filepath: str, week_tuesday: date) -> tuple[dict, int]:
    """
    Runs auto-detection, prints what was found, asks the user to confirm
    or manually correct. Returns (col_map, header_rows_to_skip).
    """
    col_map, header_row_idx = detect_columns(filepath, week_tuesday)
    header_rows = header_row_idx + 1

    print("\n[COLUMNS] Auto-detected column mapping:")
    _print_col_map(col_map, header_row_idx)

    answer = input("Are these correct? [Y/n]: ").strip().lower()

    if answer not in ("", "y", "yes"):
        print("\nEnter column letters manually. Press Enter to keep current / skip optional.")
        all_logical = ["ticket", "company", "sc", "description"] + DAYS
        required = set(DAYS)
        for logical in all_logical:
            current = _idx_to_letter(col_map[logical]) if logical in col_map else "—"
            req_tag = " (required)" if logical in required else " (optional)"
            val = input(f"  {logical:<12} [{current}]{req_tag}: ").strip()
            if val:
                col_map[logical] = _letter_to_idx(val)

        hr_input = input(f"\n  Header row number [{header_rows}]: ").strip()
        if hr_input.isdigit():
            header_rows = int(hr_input)
            header_row_idx = header_rows - 1

    # Validate
    missing = [d for d in DAYS if d not in col_map]
    if missing:
        print(f"\n[ERROR] Missing required day columns: {', '.join(missing)}. Cannot continue.")
        sys.exit(1)

    # Always reprint the final confirmed mapping
    print("\n[COLUMNS] Final confirmed mapping:")
    _print_col_map(col_map, header_row_idx)

    return col_map, header_rows


# ─────────────────────────────────────────────
# STEP 3 — WEEK DATE AUTO-DETECTION
# ─────────────────────────────────────────────

def detect_week_tuesday() -> date:
    """Returns the most recent Tuesday on or before today."""
    today = date.today()
    # weekday(): Monday=0, Tuesday=1, …
    days_since_tuesday = (today.weekday() - 1) % 7
    return today - timedelta(days=days_since_tuesday)


def confirm_week() -> date:
    """Auto-detects the week's Tuesday and asks the user to confirm or override."""
    tuesday = detect_week_tuesday()

    print(f"\n[WEEK] Detected week: Tuesday {tuesday}  →  Saturday {tuesday + timedelta(days=4)}")
    answer = input("         Use this week? [Y/n or enter date as YYYY-MM-DD]: ").strip()

    if answer.lower() in ("", "y", "yes"):
        return tuesday

    # Try parsing an override date
    try:
        override = date.fromisoformat(answer)
        if override.weekday() != 1:  # 1 = Tuesday
            # Snap to nearest Tuesday
            days_since_tuesday = (override.weekday() - 1) % 7
            override = override - timedelta(days=days_since_tuesday)
            print(f"  [WEEK] Snapped to Tuesday: {override}")
        return override
    except ValueError:
        print("  [WEEK] Invalid date, keeping auto-detected value.")
        return tuesday


# ─────────────────────────────────────────────
# AUTH — real Chrome via CDP (bypasses Conditional Access)
# ─────────────────────────────────────────────

CHROME_CDP_PORT    = 9222
CHROME_PROFILE_DIR = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")

_CHROME_CANDIDATE_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    str(Path.home() / r"AppData\Local\Google\Chrome\Application\chrome.exe"),
]


def _find_chrome() -> str:
    """Returns the path to chrome.exe, falling back to user input if not found."""
    for path in _CHROME_CANDIDATE_PATHS:
        if Path(path).exists():
            return path

    print("[AUTH] Chrome not found in standard locations.")
    path = input("       Enter full path to chrome.exe: ").strip().strip('"')
    if not Path(path).exists():
        print(f"[ERROR] Chrome not found at: {path}")
        sys.exit(1)
    return path


def _cdp_reachable() -> bool:
    """Returns True if Chrome's CDP endpoint is already listening on the debug port."""
    try:
        r = requests.get(f"http://localhost:{CHROME_CDP_PORT}/json/version", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


def _chrome_running() -> bool:
    """Returns True if any chrome.exe process is currently running."""
    import subprocess
    try:
        out = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq chrome.exe", "/NH"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return "chrome.exe" in out.lower()
    except Exception:
        return False


def _launch_chrome(chrome_exe: str) -> None:
    import subprocess
    subprocess.Popen([
        chrome_exe,
        f"--remote-debugging-port={CHROME_CDP_PORT}",
        f"--user-data-dir={CHROME_PROFILE_DIR}",
        "--profile-directory=Default",
    ])


def _wait_for_cdp() -> None:
    """Blocks until the CDP endpoint responds, up to 30 seconds."""
    print("[AUTH] Waiting for Chrome to start...", end=" ", flush=True)
    for _ in range(30):
        time.sleep(1)
        if _cdp_reachable():
            print("ready.")
            return
    print("\n[ERROR] Chrome debug endpoint did not respond within 30 s. Exiting.")
    sys.exit(1)


def login() -> requests.Session:
    """
    Connects Playwright to the user's real Chrome via CDP so that the
    Windows 10 Accounts extension and corporate compliance certificates
    are present for Microsoft SSO (Conditional Access).

    Three cases:
      1. CDP already open on port 9222 → connect directly.
      2. Chrome running but no CDP port → ask user to close Chrome, then launch it.
      3. Chrome not running → launch it ourselves.
    """
    chrome_exe = _find_chrome()

    if _cdp_reachable():
        print(f"\n[AUTH] Chrome CDP already open on port {CHROME_CDP_PORT} — connecting directly.")
    elif _chrome_running():
        print("\n[AUTH] Chrome is running but without a debug port.")
        print("       Please close ALL Chrome windows, then press Enter.")
        input("       (Press Enter when Chrome is fully closed) ")
        print(f"[AUTH] Launching Chrome with CDP on port {CHROME_CDP_PORT}...")
        _launch_chrome(chrome_exe)
        _wait_for_cdp()
    else:
        print(f"\n[AUTH] Launching Chrome with CDP on port {CHROME_CDP_PORT}...")
        print(f"       Profile : {CHROME_PROFILE_DIR}")
        _launch_chrome(chrome_exe)
        _wait_for_cdp()

    print("\n[AUTH] Connecting Playwright to Chrome via CDP...")
    print("       Complete the Microsoft SSO login in the Chrome window.")
    print("       The script will continue automatically once ServiceNow loads.\n")

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(f"http://localhost:{CHROME_CDP_PORT}")
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page    = context.pages[0]    if context.pages    else context.new_page()

        page.goto(SERVICENOW_URL)

        print("[AUTH] Waiting for login to complete (watching for g_ck)...")
        g_ck = None
        for _ in range(300):  # up to 5 minutes
            time.sleep(1)
            try:
                val = page.evaluate("window.g_ck")
                if val:
                    g_ck = val
                    break
            except Exception:
                pass

        if not g_ck:
            print("[ERROR] Timed out waiting for login. Exiting.")
            sys.exit(1)

        print("[AUTH] Login successful. g_ck acquired.")
        pw_cookies = context.cookies()
        browser.close()  # disconnects Playwright; does not close Chrome

    session = requests.Session()
    for c in pw_cookies:
        session.cookies.set(c["name"], c["value"], domain=c.get("domain", ""))

    session.headers.update({
        "X-UserToken": g_ck,
        "Content-Type": "application/json",
        "Accept": "application/json",
    })

    return session


def _check_auth(response: requests.Response) -> None:
    if response.status_code in (401, 403):
        print(f"\n[ERROR] Session expired (HTTP {response.status_code}). Re-run the script.")
        sys.exit(1)


# ─────────────────────────────────────────────
# SYS_ID RESOLUTION
# ─────────────────────────────────────────────

_sys_id_cache: dict[tuple[str, str], tuple[str, str]] = {}


def resolve_sys_ids(session: requests.Session, company_name: str, sc_name: str) -> tuple[str, str]:
    key = (company_name.strip().lower(), sc_name.strip().lower())
    if key in _sys_id_cache:
        return _sys_id_cache[key]

    print(f"  [LOOKUP] Resolving sys_ids for company='{company_name}', SC='{sc_name}'...")

    url = f"{SERVICENOW_URL}/api/now/table/time_card"
    params = {
        "sysparm_query": (
            f"u_company.nameLIKE{company_name}"
            f"^u_soc_sc_searchISNOTEMPTY"
            f"^ORDERBYDESCsys_created_on"
        ),
        "sysparm_fields": "u_company,u_soc_sc_search",
        "sysparm_display_value": "all",
        "sysparm_limit": "10",
    }

    resp = session.get(url, params=params, timeout=30)
    _check_auth(resp)

    company_id = sc_id = None

    if resp.status_code == 200:
        for rec in resp.json().get("result", []):
            comp = rec.get("u_company", {})
            sc   = rec.get("u_soc_sc_search", {})
            if sc_name.lower() in sc.get("display_value", "").lower():
                company_id = comp.get("value")
                sc_id      = sc.get("value")
                print(f"  [LOOKUP] Found: company={company_id}, SC={sc_id}")
                break

    if not company_id or not sc_id:
        print(f"\n  [LOOKUP] Could not auto-resolve sys_ids for '{company_name}' / '{sc_name}'.")
        print("           Find them via the ServiceNow URL or record's sys_id field.")
        company_id = input(f"  Company sys_id for '{company_name}': ").strip()
        sc_id      = input(f"  SC sys_id for '{sc_name}': ").strip()

    _sys_id_cache[key] = (company_id, sc_id)
    return company_id, sc_id


# ─────────────────────────────────────────────
# TC / TW OPERATIONS
# ─────────────────────────────────────────────

def create_tc(session: requests.Session, tc_data: dict) -> tuple[str, str]:
    url = f"{SERVICENOW_URL}/api/now/table/time_card"
    resp = session.post(url, json=tc_data, timeout=30)
    _check_auth(resp)
    if resp.status_code in (200, 201):
        result = resp.json().get("result", {})
        return result["sys_id"], result.get("number", "")
    raise RuntimeError(f"TC POST failed ({resp.status_code}): {resp.text[:300]}")


def get_tws(session: requests.Session, tc_sys_id: str) -> list[dict]:
    url = f"{SERVICENOW_URL}/api/now/table/task_time_worked"
    params = {
        "sysparm_query": f"u_time_card={tc_sys_id}",
        "sysparm_fields": "sys_id,u_worked_on,time_worked,comments",
        "sysparm_orderby": "sys_created_on",
    }
    resp = session.get(url, params=params, timeout=30)
    _check_auth(resp)
    return resp.json().get("result", []) if resp.status_code == 200 else []


def patch_tw_comment(session: requests.Session, tw_sys_id: str, comment: str) -> None:
    url = f"{SERVICENOW_URL}/api/now/table/task_time_worked/{tw_sys_id}"
    resp = session.patch(url, json={"comments": comment}, timeout=30)
    _check_auth(resp)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"TW PATCH failed ({resp.status_code}): {resp.text[:300]}")


# ─────────────────────────────────────────────
# EXCEL PARSING (uses runtime col_map)
# ─────────────────────────────────────────────

def _cell_float(cell) -> float:
    try:
        v = cell.value
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def process_excel(filepath: str, col_map: dict, header_rows: int) -> list[dict]:
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb[wb.sheetnames[0]]

    rows_out = []
    for i, row in enumerate(ws.iter_rows()):
        if i < header_rows:
            continue

        def col(name):
            idx = col_map.get(name)
            return row[idx] if idx is not None and idx < len(row) else None

        hours = {day: _cell_float(col(day)) for day in DAYS}
        if sum(hours.values()) == 0:
            continue

        def text(name):
            c = col(name)
            return str(c.value).strip() if c and c.value is not None else ""

        ticket  = text("ticket")
        company = text("company")
        sc      = text("sc")
        desc    = text("description")

        if not company or not sc:
            print(f"  [SKIP] Row {i + 1}: missing company or SC name.")
            continue

        rows_out.append({"ticket": ticket, "company": company, "sc": sc, "description": desc, **hours})

    print(f"[EXCEL] Read {len(rows_out)} billable rows.")
    return rows_out


# ─────────────────────────────────────────────
# TC CREATION
# ─────────────────────────────────────────────

def _day_date(day: str, week_tuesday: date) -> str:
    return (week_tuesday + timedelta(days=DAY_OFFSETS[day])).isoformat()


def process_group(
    session: requests.Session,
    rows: list[dict],
    company_id: str,
    sc_id: str,
) -> list[str]:
    """Creates one TC per row. Returns list of created tc_sys_ids."""
    created_ids = []
    for row in rows:
        remarks = f"{row['ticket']} - {row['description']}" if row["ticket"] else row["description"]
        payload = {
            "u_task_type_portal": "service_offering_commitment",
            "u_company":          company_id,
            "u_soc_sc_search":    sc_id,
            "u_remarks":          remarks,
        }
        for day in DAYS:
            payload[day] = row[day]

        label = row["ticket"] or row["description"][:40]
        print(f"  Creating TC for {label} ({row['company']})...", end=" ", flush=True)
        try:
            tc_sys_id, tc_number = create_tc(session, payload)
            print(f"✓ {tc_number}")
            created_ids.append(tc_sys_id)
        except RuntimeError as e:
            print(f"✗ ERROR: {e}")

        time.sleep(0.5)

    return created_ids


# ─────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────

def print_summary(
    session: requests.Session,
    excel_rows: list[dict],
    created_tc_ids: list[str],
    week_tuesday: date,
) -> None:
    print("\n" + "=" * 62)
    print("SUMMARY — Excel vs ServiceNow totals")
    print("=" * 62)

    excel_totals = {d: sum(r[d] for r in excel_rows) for d in DAYS}

    sn_totals = {d: 0.0 for d in DAYS}
    for tc_sys_id in created_tc_ids:
        for tw in get_tws(session, tc_sys_id):
            worked_on = tw.get("u_worked_on", "")
            try:
                hours = float(tw.get("time_worked", 0)) / 3600
            except (TypeError, ValueError):
                hours = 0.0
            for day in DAYS:
                if _day_date(day, week_tuesday) == worked_on:
                    sn_totals[day] += hours
        time.sleep(0.2)

    print(f"  {'Day':<12} {'Excel':>8} {'ServiceNow':>12} {'':>6}")
    print("  " + "-" * 42)
    for day in DAYS:
        excel_h = excel_totals[day]
        sn_h    = sn_totals[day]
        match   = "✓" if abs(excel_h - sn_h) < 0.01 else "✗"
        dt      = _day_date(day, week_tuesday)
        print(f"  {day.capitalize():<12} {excel_h:>8.2f} {sn_h:>12.2f} {match:>6}  {dt}")
    print()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    print("╔══════════════════════════════════════════╗")
    print("║   ServiceNow Timecard Automation          ║")
    print("╚══════════════════════════════════════════╝")

    # 1. File picker
    excel_file = pick_excel_file()

    # 2. Week date — must come before column detection so date headers can be matched
    week_tuesday = confirm_week()
    print(f"\n[WEEK] Using week: {week_tuesday} (Tue) → {week_tuesday + timedelta(days=4)} (Sat)")

    # 3. Column auto-detection + confirmation (uses week_tuesday to parse date headers)
    col_map, header_rows = confirm_columns(excel_file, week_tuesday)

    # 4. Authenticate
    session = login()

    # 5. Parse Excel
    rows = process_excel(excel_file, col_map, header_rows)
    if not rows:
        print("[DONE] No billable rows found. Nothing to create.")
        return

    # 6. Group by company + SC and create TCs
    rows.sort(key=lambda r: (r["company"].lower(), r["sc"].lower()))
    all_created_ids: list[str] = []

    print(f"\n[CREATE] Processing {len(rows)} row(s)...\n")

    for (company, sc), group_iter in groupby(rows, key=lambda r: (r["company"], r["sc"])):
        group = list(group_iter)
        print(f"── {company} / {sc} ({len(group)} ticket(s))")
        try:
            company_id, sc_id = resolve_sys_ids(session, company, sc)
        except Exception as e:
            print(f"  [ERROR] Could not resolve sys_ids: {e}. Skipping group.")
            continue

        created = process_group(session, group, company_id, sc_id)
        all_created_ids.extend(created)
        print()

    # 7. Summary
    if all_created_ids:
        print_summary(session, rows, all_created_ids, week_tuesday)
        print(f"[DONE] Created {len(all_created_ids)} TC record(s).")
    else:
        print("[DONE] No TCs were created.")


if __name__ == "__main__":
    main()
