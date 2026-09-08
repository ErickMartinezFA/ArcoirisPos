import { useState, useEffect, useCallback } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  ShoppingCart,
  Package,
  ClipboardList,
  Users,
  PlusCircle,
  LogOut,
  Layers,
  Circle,
  ArrowRightLeft,
  ChevronsUpDown,
} from "lucide-react";
import api from "./api";
import LoginPage from "./pages/LoginPage";
import SalesPage from "./pages/SalesPage";
import AddProductPage from "./pages/AddProductPage";
import StockEntryPage from "./pages/StockEntryPage";
import InventoryPage from "./pages/InventoryPage";
import UsersPage from "./pages/UsersPage";
import ReportsPage from "./pages/ReportsPage";
import TransferPage from "./pages/TransferPage";

// Logo hexagonal en amarillo — coherente con el acento del tema
const HexLogo = () => (
  <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
    <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="#EAB308" strokeWidth="1.5" opacity="0.4"/>
    <polygon points="18,6 28,12 28,24 18,30 8,24 8,12" fill="#EAB308" opacity="0.15"/>
    <circle cx="18" cy="18" r="5" fill="#EAB308" opacity="0.9"/>
  </svg>
);

const DashboardLayout = ({ children }) => {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user")) || { nombre: "OPERADOR" };
  const esAdmin = user.rol === 'admin';
  const [sucursales, setSucursales] = useState([]);
  const [sucursalActual, setSucursalActual] = useState(user.sucursal_id);

  useEffect(() => {
    if (esAdmin) {
      api.get('/sucursales').then(r => setSucursales(r.data.map(s => ({ ...s, nombre: s.Nombre || s.nombre })))).catch(() => {});
    }
  }, [esAdmin]);

  const cambiarSucursal = (nuevaSucursalId) => {
    const updated = { ...user, sucursal_id: Number(nuevaSucursalId) };
    localStorage.setItem("user", JSON.stringify(updated));
    setSucursalActual(Number(nuevaSucursalId));
    window.location.reload();
  };

  const menuItems = [
    { icon: <ShoppingCart size={18} />,   label: "VENTA NUEVA",   path: "/ventas" },
    { icon: <Package size={18} />,        label: "INVENTARIO",    path: "/inventario" },
    { icon: <ArrowRightLeft size={18} />, label: "TRANSFERENCIA", path: "/transferencia" },
    ...(esAdmin ? [
      { icon: <PlusCircle size={18} />,    label: "PRODUCTOS",     path: "/nuevo-producto" },
      { icon: <Layers size={18} />,        label: "ENTRADA STOCK", path: "/entrada-stock" },
      { icon: <ClipboardList size={18} />, label: "REPORTES",      path: "/reportes" },
      { icon: <Users size={18} />,         label: "USUARIOS",      path: "/usuarios" },
    ] : []),
  ];

  return (
    <div className="flex min-h-screen bg-[#0f172a] text-white font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e293b] flex flex-col border-r border-slate-700/60 shrink-0 h-screen sticky top-0">
        {/* Logo */}
        <div className="px-6 py-7 flex items-center gap-3 border-b border-slate-700/60">
          <HexLogo />
          <div>
            <h1 className="text-[17px] font-black italic tracking-tight text-white leading-none">
              <span className="text-yellow-400">ARCO</span>IRIS
            </h1>
            <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-1">
              Industrial POS
            </p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                style={{ textDecoration: 'none' }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black text-[11px] tracking-widest transition-all ${
                  active
                    ? "bg-yellow-400 text-slate-900 shadow-lg shadow-yellow-500/20"
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                <span className={active ? "text-slate-900" : "text-slate-500"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer del sidebar: operador + sucursal + logout */}
        <div className="px-4 py-5 border-t border-slate-700/60 space-y-3">
          <div className="flex items-center gap-3 px-3 py-3 bg-slate-900/60 rounded-xl border border-slate-700/40">
            <Circle size={7} className="fill-green-400 text-green-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-black text-yellow-400 uppercase tracking-wide truncate">
                {user.nombre}
              </p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                {sucursales.find(s => s.sucursal_id === sucursalActual)?.nombre || 'En línea'}
              </p>
            </div>
          </div>

          {esAdmin && sucursales.length > 1 && (
            <div className="relative">
              <ChevronsUpDown size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <select
                value={sucursalActual}
                onChange={e => cambiarSucursal(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-widest outline-none appearance-none cursor-pointer hover:border-yellow-500/50 transition-colors"
              >
                {sucursales.map(s => (
                  <option key={s.sucursal_id} value={s.sucursal_id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={async () => { try { await api.post('/auth/logout'); } catch {} localStorage.clear(); window.location.href = "/"; }}
            className="flex items-center gap-2.5 text-slate-500 hover:text-red-400 font-bold text-[11px] tracking-wider transition-colors px-3 py-2 w-full rounded-xl hover:bg-red-500/5"
          >
            <LogOut size={15} /> CERRAR SESIÓN
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header: muestra el nombre de la sección actual */}
        <header className="px-8 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xs font-black text-slate-500 tracking-widest uppercase">
              {menuItems.find(m => m.path === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>
          <p className="text-[10px] text-slate-600 font-bold tracking-wider capitalize">
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </header>

        <section className="flex-1 p-8 overflow-auto">{children}</section>
      </main>
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.rol === 'admin' ? children : <Navigate to="/ventas" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/ventas"         element={<DashboardLayout><SalesPage /></DashboardLayout>} />
        <Route path="/inventario"     element={<DashboardLayout><InventoryPage /></DashboardLayout>} />
        <Route path="/nuevo-producto" element={<DashboardLayout><AdminRoute><AddProductPage /></AdminRoute></DashboardLayout>} />
        <Route path="/entrada-stock"  element={<DashboardLayout><AdminRoute><StockEntryPage /></AdminRoute></DashboardLayout>} />
        <Route path="/transferencia"  element={<DashboardLayout><TransferPage /></DashboardLayout>} />
        <Route path="/reportes"       element={<DashboardLayout><AdminRoute><ReportsPage /></AdminRoute></DashboardLayout>} />
        <Route path="/usuarios"       element={<DashboardLayout><AdminRoute><UsersPage /></AdminRoute></DashboardLayout>} />
      </Routes>
    </Router>
  );
}

export default App;
