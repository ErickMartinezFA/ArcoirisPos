import { useState } from "react";
import { Search, ShoppingBag, Trash2, Banknote, Printer, X } from "lucide-react";
import api from "../api";

// Abre una ventana nueva solo con el ticket y manda imprimir desde ahí.
// Así evitamos el problema de que el CSS de impresión oculte el #root junto con el ticket.
const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const imprimirTicket = (ticket) => {
  const items = ticket.items.map(item => `
    <div style="margin-bottom:6px">
      <div style="font-weight:bold">${escHtml(item.nombre)}</div>
      <div style="display:flex;justify-content:space-between">
        <span>${parseFloat(item.qty)} ${escHtml(item.unidad)} × $${parseFloat(item.precio_venta).toFixed(2)}</span>
        <span>$${((parseFloat(item.precio_venta) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}</span>
      </div>
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Ticket #${ticket.ventaId}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .big { font-size: 15px; }
        @media print { @page { size: 80mm auto; margin: 0; } }
      </style>
    </head>
    <body>
      <div class="center" style="margin-bottom:8px">
        <div style="font-size:18px;font-weight:bold">EL ARCOIRIS</div>
        <div>Todo para el carpintero</div>
        <div style="margin-top:4px">${new Date().toLocaleString('es-MX')}</div>
        <div>Ticket #${ticket.ventaId}</div>
        <div>Atendido por: ${ticket.operador}</div>
      </div>
      <div class="divider"></div>
      ${items}
      <div class="divider"></div>
      <div class="row bold big"><span>TOTAL</span><span>$${ticket.total.toFixed(2)}</span></div>
      <div class="row" style="margin-top:4px"><span>Efectivo</span><span>$${parseFloat(ticket.pagoCon).toFixed(2)}</span></div>
      <div class="row bold"><span>Cambio</span><span>$${ticket.cambio.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="center">¡Gracias por su compra!</div>
    </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=350,height=600');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
};

const SalesPage = () => {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [results, setResults] = useState([]);
  const [pagoCon, setPagoCon] = useState("");
  const [ticket, setTicket] = useState(null);
  const [errorVenta, setErrorVenta] = useState("");

  const mostrarError = (msg) => {
    setErrorVenta(msg);
    setTimeout(() => setErrorVenta(""), 4000);
  };

  const getSession = () => {
    try {
      const p = JSON.parse(localStorage.getItem("user") || "{}");
      if (!p.usuario_id) { window.location.href = "/"; return null; }
      return { usuario_id: p.usuario_id, sucursal_id: p.sucursal_id, nombre: p.nombre };
    } catch {
      window.location.href = "/";
      return null;
    }
  };

  const updateQuantity = (id, value) => {
    setCart(cart.map(item => {
      if (item.producto_id !== id) return item;
      const parsed = value === "" ? "" : (item.unidad === "PZ" ? parseInt(value, 10) : parseFloat(value));
      return { ...item, qty: parsed };
    }));
  };

  const removeFromCart = (id) => setCart(cart.filter(item => item.producto_id !== id));

  const total = cart.reduce((acc, item) => acc + (parseFloat(item.precio_venta) || 0) * (parseFloat(item.qty) || 0), 0);
  const cambio = pagoCon > 0 ? parseFloat(pagoCon) - total : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (cart.some(item => !item.qty || item.qty <= 0)) return mostrarError("Revisa que todas las cantidades sean mayores a 0");
    if (cart.some(item => item.unidad === "PZ" && !Number.isInteger(item.qty))) return mostrarError("Los productos por pieza solo pueden venderse en cantidades enteras");
    if (parseFloat(pagoCon) < total) return mostrarError("El monto recibido es insuficiente");

    const session = getSession();
    if (!session) return;
    try {
      const response = await api.post('/sales', { items: cart, total, sucursal_id: session.sucursal_id });

      if (response.data.ventaId) {
        setTicket({
          ventaId: response.data.ventaId,
          items: [...cart],
          total,
          pagoCon,
          cambio,
          operador: session.nombre,
        });
        setCart([]);
        setPagoCon("");
      }
    } catch (err) {
      mostrarError(err.response?.data?.error || "Error al procesar la venta.");
    }
  };

  const searchProduct = async (e) => {
    const term = e.target.value;
    setQuery(term);
    if (term.length > 2) {
      try {
        const session = getSession();
        const res = await api.get('/products', { params: { search: term, sucursal_id: session.sucursal_id } });
        setResults(res.data);
      } catch { /* búsqueda silenciosa */ }
    } else {
      setResults([]);
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === 'Enter' && results.length === 1) {
      addToCart(results[0]);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.producto_id === product.producto_id);
    if (existing) {
      setCart(cart.map(item =>
        item.producto_id === product.producto_id ? { ...item, qty: (parseFloat(item.qty) || 0) + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
    setQuery(""); setResults([]);
  };

  return (
    <>
      {/* Modal de ticket exitoso */}
      {ticket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
              <div>
                <p className="text-xs font-black text-green-400 uppercase tracking-widest">¡Venta exitosa!</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Ticket #{ticket.ventaId}</p>
              </div>
              <button onClick={() => setTicket(null)} className="text-slate-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Resumen del ticket */}
            <div className="px-6 py-5 space-y-3 font-mono text-sm">
              <div className="text-center mb-4">
                <p className="text-xs font-black text-slate-400 tracking-widest uppercase">EL ARCOIRIS</p>
                <p className="text-[10px] text-slate-600">{new Date().toLocaleString('es-MX')}</p>
              </div>

              <div className="space-y-2 text-slate-300 text-xs border-t border-dashed border-slate-700 pt-3">
                {ticket.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate mr-2">{item.nombre} ×{parseFloat(item.qty)}</span>
                    <span className="shrink-0 text-white font-bold">
                      ${((parseFloat(item.precio_venta) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-700 pt-3 space-y-1.5">
                <div className="flex justify-between text-white font-black text-base">
                  <span>TOTAL</span>
                  <span>${ticket.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-xs">
                  <span>Efectivo</span>
                  <span>${parseFloat(ticket.pagoCon).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-400 font-bold">
                  <span>Cambio</span>
                  <span>${ticket.cambio.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="px-6 py-4 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setTicket(null)}
                className="flex-1 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 font-bold py-3 rounded-xl text-sm transition-all"
              >
                Cerrar
              </button>
              <button
                onClick={() => imprimirTicket(ticket)}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layout principal de ventas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-2 space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
            <input
              type="text"
              placeholder="Escanear código o buscar..."
              className="w-full bg-slate-800 border-2 border-slate-700 p-3 pl-12 rounded-xl focus:border-yellow-500 outline-none text-xl text-white"
              value={query}
              onChange={searchProduct}
              onKeyDown={handleSearchKey}
              autoFocus
            />
            {results.length > 0 && (
              <div className="absolute w-full bg-slate-800 border border-slate-700 rounded-xl mt-1 z-50 overflow-hidden shadow-2xl">
                {results.map((p) => (
                  <button
                    key={p.producto_id}
                    onClick={() => addToCart(p)}
                    className="w-full p-4 flex justify-between items-center hover:bg-slate-700 border-b border-slate-700 last:border-0 transition-colors"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="font-bold text-white text-lg">{p.nombre}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${p.stock_actual <= 5 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                        STOCK: {p.stock_actual} {p.unidad}
                      </span>
                    </div>
                    <span className="text-yellow-500 font-black text-xl font-mono">${p.precio_venta}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tabla del carrito */}
          <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-inner">
            <table className="w-full text-left">
              <thead className="bg-slate-700 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="p-4">Producto</th>
                  <th className="p-4 w-32">Cant.</th>
                  <th className="p-4">Precio</th>
                  <th className="p-4 text-right">Subtotal</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-16 text-center text-slate-600 text-xs font-bold uppercase tracking-widest italic">
                      Busca o escanea un producto para comenzar
                    </td>
                  </tr>
                ) : cart.map((item) => (
                  <tr key={item.producto_id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-white">{item.nombre}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">{item.unidad}</div>
                    </td>
                    <td className="p-4">
                      <input
                        type="number" step={item.unidad === "PZ" ? "1" : "any"}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-yellow-500 font-black focus:border-yellow-500 outline-none text-center"
                        value={item.qty}
                        onChange={(e) => updateQuantity(item.producto_id, e.target.value)}
                      />
                    </td>
                    <td className="p-4 text-slate-400 font-mono">${item.precio_venta}</td>
                    <td className="p-4 text-right font-black text-yellow-500 font-mono">
                      ${((parseFloat(item.precio_venta) || 0) * (parseFloat(item.qty) || 0)).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => removeFromCart(item.producto_id)} className="text-slate-500 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel de cobro */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex flex-col shadow-2xl h-fit sticky top-4">
          <div className="flex items-center gap-2 mb-6 text-slate-400 uppercase tracking-widest text-xs font-black">
            <ShoppingBag size={16} className="text-yellow-500" /> Resumen de Venta
          </div>

          <div className="space-y-6 flex-1">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total a Pagar</span>
              <div className="text-5xl font-black text-white font-mono tracking-tighter">
                ${total.toFixed(2)}
              </div>
            </div>

            <hr className="border-slate-700" />

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-[10px] text-yellow-500 font-black uppercase tracking-widest mb-2">
                  <Banknote size={14} /> Efectivo Recibido
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xl font-bold pointer-events-none">$</span>
                  <input
                    type="number" placeholder="0.00"
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 pl-8 text-2xl font-black text-white focus:border-green-500 outline-none transition-all"
                    value={pagoCon}
                    onChange={(e) => setPagoCon(e.target.value)}
                  />
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 transition-all ${cambio >= 0 && pagoCon !== "" ? 'bg-green-500/10 border-green-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">Cambio a entregar</span>
                <div className={`text-4xl font-black font-mono ${cambio < 0 ? 'text-red-500' : 'text-green-500'}`}>
                  ${cambio.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || cambio < 0 || pagoCon === ""}
            className={`w-full font-black py-5 rounded-xl text-xl mt-8 shadow-xl transition-all uppercase italic tracking-tighter ${
              cart.length === 0 || cambio < 0 || pagoCon === ""
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/40 active:scale-95'
            }`}
          >
            Finalizar Venta
          </button>

          {pagoCon !== "" && cambio < 0 && (
            <p className="text-red-500 text-[10px] font-bold uppercase mt-2 text-center animate-pulse">
              Dinero insuficiente
            </p>
          )}
          {errorVenta && (
            <div className="mt-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold text-center">
              {errorVenta}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesPage;
