import { useState, useEffect, useCallback } from "react";
import { BarChart3, Activity, DollarSign, TrendingUp, AlertTriangle, Package, Calendar, Clock, Search, X, Printer, FileDown, ShoppingBag, Percent, Receipt, CheckSquare, Square, ArrowRightLeft, Shield } from "lucide-react";
import api from "../api";

const ModalDetalleVenta = ({ ventaId, onClose, esAdmin }) => {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get(`/reports/sale/${ventaId}`)
      .then(r => setDetalle(r.data))
      .catch(() => setDetalle(null))
      .finally(() => setCargando(false));
  }, [ventaId]);

  const imprimir = () => {
    if (!detalle) return;
    const items = detalle.items.map(i => `
      <div style="margin-bottom:6px">
        <div style="font-weight:bold">${i.nombre}</div>
        <div style="display:flex;justify-content:space-between">
          <span>${i.cantidad} ${i.unidad} × $${Number(i.precio_unitario).toFixed(2)}</span>
          <span>$${Number(i.subtotal).toFixed(2)}</span>
        </div>
      </div>
    `).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ticket #${detalle.venta_id}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm}
    .c{text-align:center}.d{border-top:1px dashed #000;margin:6px 0}.r{display:flex;justify-content:space-between}
    @media print{@page{size:80mm auto;margin:0}}</style></head>
    <body>
      <div class="c" style="margin-bottom:8px">
        <div style="font-size:18px;font-weight:bold">EL ARCOIRIS</div>
        <div>${new Date(detalle.fecha).toLocaleString('es-MX')}</div>
        <div>Ticket #${detalle.venta_id} — ${detalle.vendedor}</div>
        <div>${detalle.sucursal}</div>
      </div>
      <div class="d"></div>${items}<div class="d"></div>
      <div class="r" style="font-weight:bold;font-size:15px"><span>TOTAL</span><span>$${Number(detalle.total).toFixed(2)}</span></div>
      <div class="d"></div><div class="c">¡Gracias por su compra!</div>
    </body></html>`;
    const win = window.open('', '_blank', 'width=350,height=600');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 shrink-0">
          <div>
            <p className="text-xs font-black text-yellow-400 uppercase tracking-widest">Detalle del Ticket</p>
            {detalle && (
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                #{detalle.venta_id} · {new Date(detalle.fecha).toLocaleString('es-MX')} · {detalle.vendedor} · {detalle.sucursal}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors ml-4 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cargando ? (
            <p className="text-slate-400 text-center py-8 animate-pulse font-bold">Cargando...</p>
          ) : !detalle ? (
            <p className="text-red-400 text-center py-8 font-bold">No se pudo cargar el detalle.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-700">
                <tr>
                  <th className="pb-3">Producto</th>
                  <th className="pb-3 text-center">Cant.</th>
                  <th className="pb-3 text-right">Precio</th>
                  <th className="pb-3 text-right">Subtotal</th>
                  {esAdmin && <th className="pb-3 text-right">Utilidad</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {detalle.items.map((item, i) => (
                  <tr key={i} className="text-sm">
                    <td className="py-3">
                      <p className="font-bold text-white">{item.nombre}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{item.unidad}</p>
                    </td>
                    <td className="py-3 text-center font-mono text-slate-300">{item.cantidad}</td>
                    <td className="py-3 text-right font-mono text-slate-300">${Number(item.precio_unitario).toFixed(2)}</td>
                    <td className="py-3 text-right font-mono font-black text-green-400">${Number(item.subtotal).toFixed(2)}</td>
                    {esAdmin && <td className="py-3 text-right font-mono font-black text-yellow-400">${Number(item.utilidad_item).toFixed(2)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-600">
                <tr>
                  <td colSpan="3" className="pt-4 text-[10px] text-slate-500 font-black uppercase tracking-widest">Total del ticket</td>
                  <td className="pt-4 text-right font-mono font-black text-green-400 text-base">${Number(detalle.total).toFixed(2)}</td>
                  {esAdmin && (
                    <td className="pt-4 text-right font-mono font-black text-yellow-400 text-base">
                      ${detalle.items.reduce((s, i) => s + Number(i.utilidad_item), 0).toFixed(2)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Footer */}
        {detalle && (
          <div className="px-6 py-4 border-t border-slate-700 flex gap-3 shrink-0">
            <button onClick={onClose}
              className="flex-1 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 font-bold py-3 rounded-xl text-sm transition-all">
              Cerrar
            </button>
            <button onClick={imprimir}
              className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
              <Printer size={15} /> Reimprimir
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const hoy = () => new Date().toISOString().slice(0, 10);
const primerDiaMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const getSession = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem("user") || "{}");
    if (!parsed.token) return null;
    return { sucursal_id: parsed.sucursal_id, rol: parsed.rol || 'vendedor' };
  } catch {
    return null;
  }
};

const ReportsPage = () => {
  const session = getSession();
  if (!session) { window.location.hash = '/'; return null; }
  const { sucursal_id: sessionSucursal, rol } = session;
  const esAdmin = rol === 'admin';
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [resumen, setResumen] = useState({ total_operaciones: 0, ingresos_totales: 0, utilidad_neta: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [topUtility, setTopUtility] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [history, setHistory] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [modalPDF, setModalPDF] = useState(false);
  const [seccionesPDF, setSeccionesPDF] = useState({
    resumen: true,
    topVendidos: true,
    topUtilidad: true,
    inventario: true,
    historial: true,
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };

    await Promise.allSettled([
      api.get(`/reports/daily/${sessionSucursal}`, { params })
        .then(r => setResumen(r.data))
        .catch(() => {}),

      api.get('/reports/top-products', { params })
        .then(r => setTopProducts(r.data))
        .catch(() => {}),

      api.get('/reports/history', { params })
        .then(r => setHistory(r.data))
        .catch(() => {}),

      api.get('/reports/top-utility', { params })
        .then(r => setTopUtility(r.data))
        .catch(() => {}),

      api.get(`/reports/low-stock/${sessionSucursal}`)
        .then(r => setLowStock(r.data))
        .catch(() => {}),

      esAdmin && api.get('/reports/movimientos', { params })
        .then(r => setMovimientos(r.data))
        .catch(() => {}),

      esAdmin && api.get('/reports/actividad')
        .then(r => setActividad(r.data))
        .catch(() => {}),
    ]);

    setLoading(false);
  }, [fechaInicio, fechaFin]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const generarPDF = () => {
    const s = seccionesPDF;
    const costo = Number(resumen.ingresos_totales) - Number(resumen.utilidad_neta);
    const margen = resumen.ingresos_totales > 0 ? (Number(resumen.utilidad_neta) / Number(resumen.ingresos_totales) * 100) : 0;
    const ticketProm = resumen.total_operaciones > 0 ? Number(resumen.ingresos_totales) / resumen.total_operaciones : 0;

    const secResumen = s.resumen ? `
      <div class="cards">
        <div class="card"><span>Ingresos</span><strong>$${Number(resumen.ingresos_totales).toFixed(2)}</strong></div>
        <div class="card"><span>Tickets</span><strong>${resumen.total_operaciones}</strong></div>
        ${esAdmin ? `<div class="card"><span>Utilidad Neta</span><strong>$${Number(resumen.utilidad_neta).toFixed(2)}</strong></div>` : ''}
        ${esAdmin ? `<div class="card"><span>Costo Total</span><strong>$${costo.toFixed(2)}</strong></div>` : ''}
        ${esAdmin ? `<div class="card"><span>Margen</span><strong>${margen.toFixed(1)}%</strong></div>` : ''}
        ${esAdmin ? `<div class="card"><span>Ticket Prom.</span><strong>$${ticketProm.toFixed(2)}</strong></div>` : ''}
      </div>` : '';

    const secTopVendidos = s.topVendidos && topProducts.length > 0 ? `
      <h2>Top 5 Más Vendidos</h2>
      <table><thead><tr><th>#</th><th>Producto</th><th>Cantidad</th></tr></thead><tbody>
        ${topProducts.map((p, i) => `<tr><td>${i+1}</td><td>${p.nombre}</td><td>${p.cantidad_vendida} ${p.unidad}</td></tr>`).join('')}
      </tbody></table>` : '';

    const secTopUtilidad = esAdmin && s.topUtilidad && topUtility.length > 0 ? `
      <h2>Top 5 por Utilidad</h2>
      <table><thead><tr><th>#</th><th>Producto</th><th>Vendido</th><th>Ingreso</th><th>Costo</th><th>Utilidad</th></tr></thead><tbody>
        ${topUtility.map((p, i) => `<tr><td>${i+1}</td><td>${p.nombre}</td><td>${p.cantidad_vendida} ${p.unidad}</td><td>$${Number(p.ingresos).toFixed(2)}</td><td>$${Number(p.costo).toFixed(2)}</td><td><strong>$${Number(p.utilidad).toFixed(2)}</strong></td></tr>`).join('')}
      </tbody></table>` : '';

    const secInventario = s.inventario && lowStock.length > 0 ? `
      <h2>Inventario Crítico</h2>
      <table><thead><tr><th>Producto</th><th>Stock</th><th>Nivel</th></tr></thead><tbody>
        ${lowStock.map(p => {
          const st = Number(p.stock_actual);
          const nivel = st === 0 ? 'AGOTADO' : st <= 3 ? 'CRÍTICO' : 'WARNING';
          return `<tr><td>${p.nombre}</td><td>${st} ${p.unidad}</td><td>${nivel}</td></tr>`;
        }).join('')}
      </tbody></table>` : '';

    const secHistorial = s.historial && history.length > 0 ? `
      <h2>Historial de Ventas</h2>
      <table><thead><tr><th>Ticket</th><th>Fecha</th><th>Operador</th><th>Sucursal</th><th>Total</th>${esAdmin ? '<th>Utilidad</th>' : ''}</tr></thead><tbody>
        ${history.map(v => `<tr>
          <td>#${v.venta_id}</td>
          <td>${new Date(v.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
          <td>${v.vendedor}</td><td>${v.sucursal}</td>
          <td style="text-align:right">$${Number(v.total).toFixed(2)}</td>
          ${esAdmin ? `<td style="text-align:right">$${Number(v.utilidad_neta).toFixed(2)}</td>` : ''}
        </tr>`).join('')}
      </tbody></table>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Reporte El Arcoiris ${fechaInicio} — ${fechaFin}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 2px; }
      h2 { font-size: 13px; margin: 20px 0 8px; text-transform: uppercase; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .meta { color: #888; font-size: 10px; margin-bottom: 16px; }
      .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
      .card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 16px; min-width: 120px; }
      .card span { display: block; font-size: 9px; color: #999; text-transform: uppercase; margin-bottom: 2px; }
      .card strong { font-size: 18px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
      td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
      @media print { @page { margin: 15mm; } }
    </style></head><body>
    <h1>Reporte de Ventas — El Arcoiris</h1>
    <p class="meta">Período: ${fechaInicio} al ${fechaFin} · Generado el ${new Date().toLocaleString('es-MX')}</p>
    ${secResumen}${secTopVendidos}${secTopUtilidad}${secInventario}${secHistorial}
    </body></html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    setModalPDF(false);
  };

  const rangoLabel = () => {
    if (fechaInicio === fechaFin) return new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const ini = new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const fin = new Date(fechaFin + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${ini} — ${fin}`;
  };

  return (
    <div className="space-y-6">
      {modalPDF && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <p className="text-xs font-black text-yellow-400 uppercase tracking-widest">Exportar PDF</p>
              <button onClick={() => setModalPDF(false)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Selecciona qué incluir</p>
              {[
                { key: 'resumen',      label: 'Resumen financiero (KPIs)' },
                { key: 'topVendidos',  label: 'Top 5 más vendidos' },
                ...(esAdmin ? [{ key: 'topUtilidad', label: 'Top 5 por utilidad' }] : []),
                { key: 'inventario',   label: 'Inventario crítico' },
                { key: 'historial',    label: 'Historial de ventas' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSeccionesPDF(prev => ({ ...prev, [key]: !prev[key] }))}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-700/50 transition-colors"
                >
                  {seccionesPDF[key]
                    ? <CheckSquare size={17} className="text-yellow-400 shrink-0" />
                    : <Square size={17} className="text-slate-600 shrink-0" />}
                  <span className={`text-sm font-bold ${seccionesPDF[key] ? 'text-white' : 'text-slate-500'}`}>{label}</span>
                </button>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex gap-3">
              <button onClick={() => setModalPDF(false)}
                className="flex-1 border border-slate-600 text-slate-400 hover:text-white font-bold py-3 rounded-xl text-sm transition-all">
                Cancelar
              </button>
              <button onClick={generarPDF}
                disabled={!Object.values(seccionesPDF).some(Boolean)}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                <FileDown size={15} /> Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {ventaSeleccionada && (
        <ModalDetalleVenta
          ventaId={ventaSeleccionada}
          onClose={() => setVentaSeleccionada(null)}
          esAdmin={esAdmin}
        />
      )}
      {/* Cabecera + selector de fechas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-yellow-500" size={32} />
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">
              Dashboard Operativo
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{rangoLabel()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
          <Calendar size={14} className="text-slate-500 shrink-0" />
          <input
            type="date"
            value={fechaInicio}
            max={fechaFin}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="bg-transparent text-white text-sm font-bold outline-none"
          />
          <span className="text-slate-600 font-bold">—</span>
          <input
            type="date"
            value={fechaFin}
            min={fechaInicio}
            max={hoy()}
            onChange={(e) => setFechaFin(e.target.value)}
            className="bg-transparent text-white text-sm font-bold outline-none"
          />
          <button
            onClick={fetchReports}
            className="ml-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
          >
            <Search size={12} /> Aplicar
          </button>
          <button
            onClick={() => setModalPDF(true)}
            className="ml-1 border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
          >
            <FileDown size={12} /> PDF
          </button>
        </div>
      </div>

      {/* Accesos rápidos de rango */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Hoy', ini: hoy(), fin: hoy() },
          { label: 'Esta semana', ini: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })(), fin: hoy() },
          { label: 'Este mes', ini: primerDiaMes(), fin: hoy() },
          { label: 'Último mes', ini: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 10); })(), fin: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10); })() },
        ].map(({ label, ini, fin }) => (
          <button
            key={label}
            onClick={() => { setFechaInicio(ini); setFechaFin(fin); }}
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
              fechaInicio === ini && fechaFin === fin
                ? 'bg-yellow-400 text-slate-900 border-yellow-400'
                : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20 animate-pulse font-black">Cargando métricas...</div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 relative overflow-hidden">
              <div className="bg-green-500/10 p-4 rounded-xl text-green-500 z-10">
                <DollarSign size={40} />
              </div>
              <div className="z-10">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Ingresos</span>
                <span className="text-4xl font-black text-white font-mono tracking-tighter">
                  ${Number(resumen.ingresos_totales).toFixed(2)}
                </span>
              </div>
              <DollarSign size={160} className="absolute -right-6 -bottom-6 text-slate-700/20" />
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 relative overflow-hidden">
              <div className="bg-blue-500/10 p-4 rounded-xl text-blue-500 z-10">
                <Activity size={40} />
              </div>
              <div className="z-10">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Tickets</span>
                <span className="text-4xl font-black text-white font-mono tracking-tighter">
                  {resumen.total_operaciones}
                </span>
              </div>
              <Activity size={160} className="absolute -right-6 -bottom-6 text-slate-700/20" />
            </div>

            {esAdmin && (
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 relative overflow-hidden">
                <div className="bg-yellow-500/10 p-4 rounded-xl text-yellow-500 z-10">
                  <TrendingUp size={40} />
                </div>
                <div className="z-10">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Utilidad Neta</span>
                  <span className="text-4xl font-black text-yellow-400 font-mono tracking-tighter">
                    ${Number(resumen.utilidad_neta).toFixed(2)}
                  </span>
                </div>
                <TrendingUp size={160} className="absolute -right-6 -bottom-6 text-slate-700/20" />
              </div>
            )}
          </div>

          {/* KPIs financieros — solo admin */}
          {esAdmin && (() => {
            const costo = Number(resumen.ingresos_totales) - Number(resumen.utilidad_neta);
            const margen = resumen.ingresos_totales > 0 ? (Number(resumen.utilidad_neta) / Number(resumen.ingresos_totales)) * 100 : 0;
            const ticketProm = resumen.total_operaciones > 0 ? Number(resumen.ingresos_totales) / resumen.total_operaciones : 0;

            // Gráfica de barras por día desde el historial
            const porDia = history.reduce((acc, v) => {
              const dia = v.fecha.slice(0, 10);
              if (!acc[dia]) acc[dia] = { total: 0, utilidad: 0 };
              acc[dia].total += Number(v.total);
              acc[dia].utilidad += Number(v.utilidad_neta);
              return acc;
            }, {});
            const diasOrdenados = Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b));
            const maxTotal = Math.max(...diasOrdenados.map(([, d]) => d.total), 1);

            return (
              <>
                {/* 3 KPIs extra */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 relative overflow-hidden">
                    <div className="bg-red-500/10 p-4 rounded-xl text-red-400 z-10"><ShoppingBag size={40} /></div>
                    <div className="z-10">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Costo Total</span>
                      <span className="text-4xl font-black text-red-400 font-mono tracking-tighter">${costo.toFixed(2)}</span>
                    </div>
                    <ShoppingBag size={160} className="absolute -right-6 -bottom-6 text-slate-700/20" />
                  </div>

                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 relative overflow-hidden">
                    <div className="bg-purple-500/10 p-4 rounded-xl text-purple-400 z-10"><Percent size={40} /></div>
                    <div className="z-10">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Margen Bruto</span>
                      <span className="text-4xl font-black text-purple-400 font-mono tracking-tighter">{margen.toFixed(1)}%</span>
                    </div>
                    <Percent size={160} className="absolute -right-6 -bottom-6 text-slate-700/20" />
                  </div>

                  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 relative overflow-hidden">
                    <div className="bg-cyan-500/10 p-4 rounded-xl text-cyan-400 z-10"><Receipt size={40} /></div>
                    <div className="z-10">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Ticket Promedio</span>
                      <span className="text-4xl font-black text-cyan-400 font-mono tracking-tighter">${ticketProm.toFixed(2)}</span>
                    </div>
                    <Receipt size={160} className="absolute -right-6 -bottom-6 text-slate-700/20" />
                  </div>
                </div>

                {/* Gráfica por día + top por utilidad */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Gráfica de barras */}
                  <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
                    <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center gap-2">
                      <BarChart3 className="text-cyan-400" size={18} />
                      <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Ventas por Día</span>
                    </div>
                    <div className="p-4">
                      {diasOrdenados.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center mt-8 italic">Sin datos en el período</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {diasOrdenados.map(([dia, datos]) => (
                            <div key={dia}>
                              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                <span>{new Date(dia + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                <span className="text-white">${datos.total.toFixed(0)} <span className="text-yellow-400">+${datos.utilidad.toFixed(0)}</span></span>
                              </div>
                              <div className="flex gap-1 h-4">
                                <div className="bg-green-500/30 rounded-sm h-full relative overflow-hidden flex-shrink-0" style={{ width: `${(datos.total / maxTotal) * 100}%`, minWidth: '4px' }}>
                                  <div className="absolute inset-0 bg-green-500/60 rounded-sm" style={{ width: `${datos.total > 0 ? (datos.utilidad / datos.total) * 100 : 0}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700">
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-3 h-3 rounded-sm bg-green-500/30 inline-block" /> Ingreso</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className="w-3 h-3 rounded-sm bg-green-500/60 inline-block" /> Utilidad</span>
                      </div>
                    </div>
                  </div>

                  {/* Top 5 por utilidad */}
                  <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
                    <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center gap-2">
                      <TrendingUp className="text-yellow-400" size={18} />
                      <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Top 5 por Utilidad</span>
                    </div>
                    <div className="p-4">
                      {topUtility.length === 0 ? (
                        <p className="text-slate-500 text-sm text-center mt-8 italic">Sin ventas en el período</p>
                      ) : (
                        <div className="space-y-3">
                          {topUtility.map((prod, idx) => (
                            <div key={idx} className="bg-slate-900/30 p-3 rounded-lg border border-slate-700/50">
                              <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-slate-600 w-4">{idx + 1}</span>
                                  <span className="font-bold text-white text-sm">{prod.nombre}</span>
                                </div>
                                <span className="text-yellow-400 font-black font-mono text-sm">${Number(prod.utilidad).toFixed(2)}</span>
                              </div>
                              <div className="flex gap-4 text-[10px] text-slate-500 pl-6">
                                <span>Vendido: <span className="text-slate-300 font-bold">{prod.cantidad_vendida} {prod.unidad}</span></span>
                                <span>Ingreso: <span className="text-green-400 font-bold">${Number(prod.ingresos).toFixed(2)}</span></span>
                                <span>Costo: <span className="text-red-400 font-bold">${Number(prod.costo).toFixed(2)}</span></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Top productos + stock crítico */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center gap-2">
                <Package className="text-amber-500" size={18} />
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Top 5 Más Vendidos</span>
              </div>
              <div className="p-4 flex-1">
                {topProducts.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center mt-8 italic">Sin ventas en el período</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((prod, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-900/30 p-3 rounded-lg border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-slate-600 w-4">{idx + 1}</span>
                          <span className="font-bold text-white text-sm">{prod.nombre}</span>
                        </div>
                        <span className="text-amber-500 font-black font-mono bg-amber-500/10 px-3 py-1 rounded-md text-sm shrink-0">
                          {prod.cantidad_vendida} {prod.unidad || 'pzas'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center gap-2">
                <AlertTriangle className="text-red-500 animate-pulse" size={18} />
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Inventario Crítico</span>
              </div>
              <div className="p-4 flex-1">
                {lowStock.length === 0 ? (
                  <p className="text-green-500 text-sm font-bold text-center mt-8">Inventario sano. Nada por agotar.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {lowStock.map((prod, idx) => {
                      const stock = Number(prod.stock_actual);
                      const agotado  = stock === 0;
                      const critical = stock > 0 && stock <= 3;
                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${
                          agotado  ? 'bg-slate-700/40 border-slate-600/40' :
                          critical ? 'bg-red-500/10 border-red-500/30' :
                                     'bg-yellow-500/10 border-yellow-500/20'
                        }`}>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
                                agotado  ? 'bg-slate-600 text-slate-300' :
                                critical ? 'bg-red-500/20 text-red-400' :
                                           'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {agotado ? 'AGOTADO' : critical ? 'CRÍTICO' : 'WARNING'}
                              </span>
                              <span className="font-bold text-white text-sm truncate">{prod.nombre}</span>
                            </div>
                            <span className={`font-black font-mono text-sm shrink-0 ml-2 ${
                              agotado ? 'text-slate-500' : critical ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                              {agotado ? '—' : `${stock} ${prod.unidad}`}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pl-1">
                            {prod.sucursal_nombre && (
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                {prod.sucursal_nombre}
                              </span>
                            )}
                            {(prod.otras_sucursales || []).map((o, i) => (
                              <span key={i} className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                                ↗ {o.sucursal}: {o.stock} disp.
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Historial de ventas con utilidad neta */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="text-blue-500" size={18} />
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Historial de Ventas</span>
              </div>
              <span className="text-[10px] text-slate-500 font-bold">{history.length} registros</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900/80 sticky top-0 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="p-4 border-b border-slate-700">Ticket</th>
                    <th className="p-4 border-b border-slate-700">Fecha</th>
                    <th className="p-4 border-b border-slate-700">Operador</th>
                    <th className="p-4 border-b border-slate-700">Sucursal</th>
                    <th className="p-4 border-b border-slate-700 text-right">Total</th>
                    {esAdmin && <th className="p-4 border-b border-slate-700 text-right">Utilidad</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {history.map((venta) => (
                    <tr
                      key={venta.venta_id}
                      onClick={() => setVentaSeleccionada(venta.venta_id)}
                      className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                    >
                      <td className="p-4 font-mono text-slate-400 text-sm">#{venta.venta_id}</td>
                      <td className="p-4 text-slate-400 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-slate-600 shrink-0" />
                          {new Date(venta.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-white">{venta.vendedor}</td>
                      <td className="p-4 text-xs font-bold text-slate-400 uppercase">{venta.sucursal}</td>
                      <td className="p-4 text-right font-mono font-black text-green-400">
                        ${Number(venta.total).toFixed(2)}
                      </td>
                      {esAdmin && (
                        <td className="p-4 text-right font-mono font-black text-yellow-400">
                          ${Number(venta.utilidad_neta).toFixed(2)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 italic text-sm">
                        No hay ventas en el período seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Log de actividad — solo admin */}
          {esAdmin && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="text-purple-400" size={18} />
                  <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Actividad de Usuarios</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{actividad.length} registros recientes</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/80 sticky top-0 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-4 border-b border-slate-700">Fecha</th>
                      <th className="p-4 border-b border-slate-700">Usuario</th>
                      <th className="p-4 border-b border-slate-700">Acción</th>
                      <th className="p-4 border-b border-slate-700">Detalle</th>
                      <th className="p-4 border-b border-slate-700">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-sm">
                    {actividad.map((a) => {
                      const colorAccion = {
                        LOGIN:             'bg-green-500/10 text-green-400 border-green-500/30',
                        LOGOUT:            'bg-slate-500/10 text-slate-400 border-slate-500/30',
                        VENTA:             'bg-blue-500/10 text-blue-400 border-blue-500/30',
                        ENTRADA_STOCK:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
                        TRANSFERENCIA:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
                        PRODUCTO_CREADO:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                        PRODUCTO_EDITADO:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
                        USUARIO_CREADO:    'bg-purple-500/10 text-purple-400 border-purple-500/30',
                        USUARIO_ELIMINADO: 'bg-red-500/10 text-red-400 border-red-500/30',
                      }[a.accion] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';

                      return (
                        <tr key={a.actividad_id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="p-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                            {new Date(a.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold text-white">{a.usuario}</td>
                          <td className="p-4">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${colorAccion}`}>
                              {a.accion.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 text-xs max-w-xs truncate">{a.descripcion || '—'}</td>
                          <td className="p-4 text-slate-600 font-mono text-xs">{a.ip || '—'}</td>
                        </tr>
                      );
                    })}
                    {actividad.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500 italic text-sm">
                          Sin actividad registrada aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Movimientos de inventario — solo admin */}
          {esAdmin && (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="text-cyan-500" size={18} />
                  <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Movimientos de Inventario</span>
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{movimientos.length} registros</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/80 sticky top-0 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="p-4 border-b border-slate-700">Tipo</th>
                      <th className="p-4 border-b border-slate-700">Fecha</th>
                      <th className="p-4 border-b border-slate-700">Producto</th>
                      <th className="p-4 border-b border-slate-700">Cantidad</th>
                      <th className="p-4 border-b border-slate-700">Origen</th>
                      <th className="p-4 border-b border-slate-700">Destino</th>
                      <th className="p-4 border-b border-slate-700">Operador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 text-sm">
                    {movimientos.map((m) => (
                      <tr key={m.movimiento_id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="p-4">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                            m.tipo === 'entrada'
                              ? 'bg-green-500/10 text-green-400 border-green-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                          }`}>
                            {m.tipo === 'entrada' ? 'Entrada' : 'Transferencia'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 font-mono text-xs">
                          {new Date(m.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 font-bold text-white">{m.producto}</td>
                        <td className="p-4 font-mono font-black text-yellow-400">{m.cantidad} {m.unidad}</td>
                        <td className="p-4 text-slate-400">{m.sucursal_origen}</td>
                        <td className="p-4 text-slate-400">{m.sucursal_destino}</td>
                        <td className="p-4 text-slate-400">{m.usuario}</td>
                      </tr>
                    ))}
                    {movimientos.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-500 italic text-sm">
                          No hay movimientos en el período seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
