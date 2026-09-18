import { useState, useRef, useEffect } from "react";
import { Search, ShoppingBag, Trash2, Banknote, Printer, X, Tag } from "lucide-react";
import api from "../api";
import { importeLinea, fmtPrecio } from "../precio";
import { imprimirTicket } from "../ticket";

const imprimirVenta = (ticket) => imprimirTicket({
  ventaId: ticket.ventaId,
  operador: ticket.operador,
  items: ticket.items.map(i => ({
    nombre: i.nombre,
    cantidad: i.qty,
    unidad: i.unidad,
    precioUnitario: i.precio_venta,
    subtotal: importeLinea(i.precio_venta, i.qty),
  })),
  total: ticket.total,
  pagoCon: ticket.pagoCon,
  cambio: ticket.cambio,
  promociones: ticket.descuentos,
});

const SIN_PROMO = { firma: '[]', aplicadas: [], descuento_total: 0 };

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

  // Clave única de carrito: un producto puede aparecer varias veces con distinta presentación
  const cartKey = (item) => `${item.producto_id}-${item.presentacion_id || 'base'}`;

  const updateQuantity = (key, value) => {
    setCart(cart.map(item => {
      if (cartKey(item) !== key) return item;
      const esEntero = item.unidad === "PZ" || item.isPresentacion;
      const parsed = value === "" ? "" : (esEntero ? parseInt(value, 10) : parseFloat(value));
      return { ...item, qty: parsed };
    }));
  };

  const removeFromCart = (key) => setCart(cart.filter(item => cartKey(item) !== key));

  // Promociones: el servidor dice cuáles aplican al carrito (solo renglones sin presentación).
  // Se pide con un pequeño retraso y se descartan respuestas viejas; mientras la respuesta no
  // corresponda al carrito actual no se deja cobrar, para no mostrar un total desfasado.
  const [promo, setPromo] = useState(SIN_PROMO);
  const promoSeq = useRef(0);
  const lineasPromo = cart.filter(i => !i.presentacion_id && i.qty > 0).map(i => [i.producto_id, i.qty]);
  const firmaCarrito = JSON.stringify(lineasPromo);
  useEffect(() => {
    if (firmaCarrito === '[]') return;
    const seq = ++promoSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.post('/promotions/aplicar', { items: JSON.parse(firmaCarrito).map(([producto_id, qty]) => ({ producto_id, qty })) });
        if (seq === promoSeq.current) setPromo({ ...res.data, firma: firmaCarrito });
      } catch {
        // Sin promociones si falla la consulta; el servidor las recalcula al cobrar
        if (seq === promoSeq.current) setPromo({ ...SIN_PROMO, firma: firmaCarrito });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [firmaCarrito]);
  const promoVigente = firmaCarrito === '[]' ? SIN_PROMO : promo;
  const promoSincronizada = firmaCarrito === '[]' || promo.firma === firmaCarrito;

  // Cada renglón se redondea a centavos y luego se suma: es lo mismo que calcula el servidor.
  const subtotal = cart.reduce((acc, item) => acc + importeLinea(item.precio_venta, item.qty), 0);
  const descuento = promoSincronizada ? promoVigente.descuento_total : 0;
  const total = Math.round((subtotal - descuento) * 100) / 100;
  const cambio = pagoCon > 0 ? parseFloat(pagoCon) - total : 0;

  const handleCheckout = async () => {
    if (cart.length === 0 || !promoSincronizada) return;
    if (cart.some(item => !item.qty || item.qty <= 0)) return mostrarError("Revisa que todas las cantidades sean mayores a 0");
    if (cart.some(item => (item.unidad === "PZ" || item.isPresentacion) && !Number.isInteger(item.qty))) return mostrarError("Esta cantidad solo puede venderse en unidades enteras");
    if (parseFloat(pagoCon) < total) return mostrarError("El monto recibido es insuficiente");

    const session = getSession();
    if (!session) return;
    try {
      const response = await api.post('/sales', { items: cart, total, sucursal_id: session.sucursal_id });

      if (response.data.ventaId) {
        // El total y las promociones del ticket son los que cobró el servidor
        const totalCobrado = Number(response.data.total);
        setTicket({
          ventaId: response.data.ventaId,
          items: [...cart],
          total: totalCobrado,
          descuentos: response.data.descuentos || [],
          pagoCon,
          cambio: parseFloat(pagoCon) - totalCobrado,
          operador: session.nombre,
        });
        setCart([]);
        setPagoCon("");
      }
    } catch (err) {
      mostrarError(err.response?.data?.error || "Error al procesar la venta.");
    }
  };

  // Descarta respuestas viejas: si llegan desordenadas, no deben pisar la búsqueda más reciente
  const searchSeq = useRef(0);

  const searchProduct = async (e) => {
    const term = e.target.value;
    setQuery(term);
    if (term.length > 2) {
      const seq = ++searchSeq.current;
      try {
        const session = getSession();
        const res = await api.get('/products', { params: { search: term, sucursal_id: session.sucursal_id } });
        if (seq === searchSeq.current) setResults(res.data);
      } catch { /* búsqueda silenciosa */ }
    } else {
      searchSeq.current++;
      setResults([]);
    }
  };

  // La pistola escribe el código y manda Enter de inmediato, antes de que llegue la búsqueda
  // por teclazo. Al presionar Enter se consulta con el texto completo, no con resultados parciales.
  const handleSearchKey = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const term = query.trim();
    if (term.length < 3) return;
    const session = getSession();
    if (!session) return;
    try {
      searchSeq.current++;
      const res = await api.get('/products', { params: { search: term, sucursal_id: session.sucursal_id } });
      const exacto = res.data.find(p => p.codigo_barras === term);
      const unico = res.data.length === 1 ? res.data[0] : null;
      const match = exacto || unico;
      if (match) addToCart(match);
      else if (res.data.length > 1) setResults(res.data);
      else mostrarError(`No se encontró ningún producto con "${term}"`);
    } catch {
      mostrarError("No se pudo buscar el producto. Revisa tu conexión.");
    }
  };

  const addToCart = (product, presentacion = null) => {
    const item = presentacion
      ? {
          producto_id: product.producto_id,
          presentacion_id: presentacion.presentacion_id,
          nombre: `${product.nombre} (${presentacion.nombre})`,
          unidad: presentacion.nombre,
          precio_venta: presentacion.precio_venta,
          isPresentacion: true,
        }
      : product;
    const key = cartKey(item);
    const existing = cart.find(i => cartKey(i) === key);
    if (existing) {
      setCart(cart.map(i => cartKey(i) === key ? { ...i, qty: (parseFloat(i.qty) || 0) + 1 } : i));
    } else {
      setCart([...cart, { ...item, qty: 1 }]);
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
                      ${importeLinea(item.precio_venta, item.qty).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-700 pt-3 space-y-1.5">
                {ticket.descuentos.map(a => (
                  <div key={a.promocion_id} className="flex justify-between text-green-400 text-xs font-bold">
                    <span className="truncate mr-2">Promo {a.nombre}{a.veces > 1 ? ` ×${a.veces}` : ''}</span>
                    <span className="shrink-0">-${a.descuento.toFixed(2)}</span>
                  </div>
                ))}
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
                onClick={() => imprimirVenta(ticket)}
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
                  p.presentaciones && p.presentaciones.length > 0 ? (
                    <div key={p.producto_id} className="border-b border-slate-700 last:border-0">
                      <div className="px-4 pt-3 pb-1">
                        <span className="font-bold text-white text-lg">{p.nombre}</span>
                        <span className={`ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded ${p.stock_actual <= 5 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                          STOCK: {p.stock_actual} {p.unidad}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 px-4 pb-3">
                        {p.presentaciones.map(pres => (
                          <button
                            key={pres.presentacion_id}
                            onClick={() => addToCart(p, pres)}
                            className="bg-slate-700 hover:bg-yellow-500 hover:text-slate-900 text-white text-sm font-bold px-3 py-2 rounded-lg transition-colors"
                          >
                            {pres.nombre} · ${fmtPrecio(pres.precio_venta)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
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
                      <span className="text-yellow-500 font-black text-xl font-mono">${fmtPrecio(p.precio_venta)}</span>
                    </button>
                  )
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
                  <tr key={cartKey(item)} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-white">{item.nombre}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">{item.unidad}</div>
                    </td>
                    <td className="p-4">
                      <input
                        type="number" step={(item.unidad === "PZ" || item.isPresentacion) ? "1" : "any"}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-yellow-500 font-black focus:border-yellow-500 outline-none text-center"
                        value={item.qty}
                        onChange={(e) => updateQuantity(cartKey(item), e.target.value)}
                      />
                    </td>
                    <td className="p-4 text-slate-400 font-mono">${fmtPrecio(item.precio_venta)}</td>
                    <td className="p-4 text-right font-black text-yellow-500 font-mono">
                      ${importeLinea(item.precio_venta, item.qty).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => removeFromCart(cartKey(item))} className="text-slate-500 hover:text-red-500 transition-colors">
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
              {promoVigente.aplicadas.length > 0 && promoSincronizada && (
                <div className="mt-3 rounded-xl border border-green-500/40 bg-green-500/10 p-3 space-y-1.5">
                  {promoVigente.aplicadas.map(a => (
                    <div key={a.promocion_id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="flex items-start gap-1.5 font-bold text-green-400">
                        <Tag size={13} className="mt-0.5 shrink-0" />
                        <span>Promoción aplicada: {a.nombre}{a.veces > 1 ? ` ×${a.veces}` : ''}</span>
                      </span>
                      <span className="font-mono font-black text-green-400 shrink-0">-${a.descuento.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1 border-t border-green-500/20">
                    Subtotal ${subtotal.toFixed(2)}
                  </div>
                </div>
              )}
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
            disabled={cart.length === 0 || cambio < 0 || pagoCon === "" || !promoSincronizada}
            className={`w-full font-black py-5 rounded-xl text-xl mt-8 shadow-xl transition-all uppercase italic tracking-tighter ${
              cart.length === 0 || cambio < 0 || pagoCon === "" || !promoSincronizada
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
