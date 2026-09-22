import { useState, useEffect, useRef } from 'react';
import { Tag, Search, Plus, Trash2, Power } from 'lucide-react';
import api from '../api';
import { fmtPrecio } from '../precio';

const FORM_VACIO = { nombre: '', tipo: 'precio_combo', valor: '', items: [] };

const PromotionsPage = () => {
    const [promos, setPromos] = useState([]);
    const [form, setForm] = useState(FORM_VACIO);
    const [busqueda, setBusqueda] = useState('');
    const [resultados, setResultados] = useState([]);
    const [mensaje, setMensaje] = useState({ texto: '', error: false });
    const [guardando, setGuardando] = useState(false);
    const busquedaSeq = useRef(0);

    const avisar = (texto, error = false) => setMensaje({ texto, error });

    const errorCarga = () => avisar('No se pudieron cargar las promociones. Recarga la página.', true);

    const cargar = () => api.get('/promotions').then(res => setPromos(res.data)).catch(errorCarga);

    useEffect(() => {
        let activo = true;
        api.get('/promotions')
            .then(res => { if (activo) setPromos(res.data); })
            .catch(() => { if (activo) setMensaje({ texto: 'No se pudieron cargar las promociones. Recarga la página.', error: true }); });
        return () => { activo = false; };
    }, []);

    const buscar = async (e) => {
        const term = e.target.value;
        setBusqueda(term);
        if (term.length < 2) { busquedaSeq.current++; setResultados([]); return; }
        const seq = ++busquedaSeq.current;
        try {
            const res = await api.get('/products', { params: { search: term } });
            if (seq === busquedaSeq.current) setResultados(res.data.slice(0, 8));
        } catch { /* búsqueda silenciosa */ }
    };

    const agregarProducto = (p) => {
        if (form.items.some(i => i.producto_id === p.producto_id)) {
            avisar('Ese producto ya está en la promoción', true);
        } else {
            avisar('');
            setForm(f => ({ ...f, items: [...f.items, { producto_id: p.producto_id, nombre: p.nombre, unidad: p.unidad, precio_venta: Number(p.precio_venta), cantidad: 1 }] }));
        }
        setBusqueda(''); setResultados([]);
    };

    const cambiarCantidad = (id, cantidad) =>
        setForm(f => ({ ...f, items: f.items.map(i => i.producto_id === id ? { ...i, cantidad } : i) }));

    const quitarProducto = (id) =>
        setForm(f => ({ ...f, items: f.items.filter(i => i.producto_id !== id) }));

    const precioNormal = form.items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * i.precio_venta, 0);
    const valor = parseFloat(form.valor);
    const precioFinal = form.tipo === 'precio_combo' ? valor : precioNormal - valor;
    const ahorro = precioNormal - precioFinal;

    const guardar = async (e) => {
        e.preventDefault();
        if (guardando) return;
        if (form.items.length === 0) return avisar('Agrega al menos un producto a la promoción', true);
        if (form.items.some(i => !(parseFloat(i.cantidad) > 0))) return avisar('Las cantidades deben ser mayores a 0', true);
        setGuardando(true);
        try {
            await api.post('/promotions', {
                nombre: form.nombre,
                tipo: form.tipo,
                valor,
                items: form.items.map(i => ({ producto_id: i.producto_id, cantidad: parseFloat(i.cantidad) })),
            });
            setForm(FORM_VACIO);
            avisar('Promoción creada');
            cargar();
        } catch (err) {
            avisar(err.response?.data?.error || 'No se pudo crear la promoción', true);
        } finally {
            setGuardando(false);
        }
    };

    const alternar = async (p) => {
        try {
            await api.patch(`/promotions/${p.promocion_id}`, { activa: !p.activa });
            cargar();
        } catch (err) {
            avisar(err.response?.data?.error || 'No se pudo actualizar la promoción', true);
        }
    };

    const eliminar = async (p) => {
        if (!window.confirm(`¿Eliminar la promoción "${p.nombre}"?`)) return;
        try {
            await api.delete(`/promotions/${p.promocion_id}`);
            cargar();
        } catch (err) {
            avisar(err.response?.data?.error || 'No se pudo eliminar la promoción', true);
        }
    };

    const resumenItems = (items) => items.map(i => `${i.cantidad} ${i.nombre}`).join(' + ');
    const descripcionPrecio = (p) => p.tipo === 'precio_combo'
        ? `Combo a $${fmtPrecio(p.valor)}`
        : `Descuento de $${fmtPrecio(p.valor)}`;

    return (
        <div className="flex flex-col gap-6">
            {mensaje.texto && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold border ${
                    mensaje.error
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                    {mensaje.texto}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Lista de promociones */}
                <div className="lg:col-span-3 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                    <h2 className="text-xl font-black text-yellow-500 mb-6 flex items-center gap-2 uppercase italic">
                        <Tag size={22} /> Promociones
                    </h2>

                    {promos.length === 0 ? (
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest text-center py-12">
                            Aún no hay promociones. Crea la primera con el formulario.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {promos.map(p => (
                                <div key={p.promocion_id} className={`p-4 rounded-xl border transition-all ${p.activa ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-900/30 border-slate-800 opacity-60'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-black text-white">{p.nombre}</p>
                                            <p className="text-xs text-slate-400 mt-1 break-words">{resumenItems(p.items)}</p>
                                            <p className="text-xs mt-2">
                                                <span className="text-yellow-400 font-bold">{descripcionPrecio(p)}</span>
                                                <span className="text-slate-500"> · normal ${p.precio_normal.toFixed(2)} · ahorro </span>
                                                <span className={p.ahorro > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>${p.ahorro.toFixed(2)}</span>
                                            </p>
                                            {p.ahorro <= 0 && (
                                                <p className="text-[10px] text-red-400 font-bold uppercase mt-1">
                                                    Ya no aplica: los precios cambiaron y el combo no ahorra nada
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => alternar(p)}
                                                title={p.activa ? 'Desactivar' : 'Activar'}
                                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                                                    p.activa
                                                        ? 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                                                        : 'border-slate-600 text-slate-400 hover:border-green-500 hover:text-green-400'
                                                }`}
                                            >
                                                <Power size={12} /> {p.activa ? 'Activa' : 'Inactiva'}
                                            </button>
                                            <button onClick={() => eliminar(p)} title="Eliminar" className="text-slate-500 hover:text-red-500 transition-colors p-1.5">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Formulario */}
                <form onSubmit={guardar} className="lg:col-span-2 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-5 h-fit">
                    <h3 className="text-sm font-black text-slate-400 flex items-center gap-2 uppercase">
                        <Plus size={16} /> Nueva promoción
                    </h3>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre</label>
                        <input
                            type="text" required maxLength={80} placeholder="Ej. Combo pegamento + brocha"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                            value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Productos del combo</label>
                        <div className="relative mt-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            <input
                                type="text" placeholder="Buscar producto por nombre o código..."
                                className="w-full pl-9 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 text-sm"
                                value={busqueda} onChange={buscar}
                            />
                            {resultados.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                                    {resultados.map(p => (
                                        <button
                                            type="button" key={p.producto_id} onClick={() => agregarProducto(p)}
                                            className="w-full flex justify-between items-center px-3 py-2 text-left text-sm hover:bg-slate-800 border-b border-slate-800 last:border-0"
                                        >
                                            <span className="text-white truncate mr-2">{p.nombre}</span>
                                            <span className="text-yellow-500 font-mono shrink-0">${fmtPrecio(p.precio_venta)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {form.items.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {form.items.map(i => (
                                    <div key={i.producto_id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-xl p-2">
                                        <input
                                            type="number" min={i.unidad === 'PZ' ? '1' : '0.001'} step={i.unidad === 'PZ' ? '1' : 'any'} required
                                            className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-yellow-500 font-black text-center outline-none focus:border-yellow-500"
                                            value={i.cantidad} onChange={e => cambiarCantidad(i.producto_id, e.target.value)}
                                        />
                                        <div className="flex-1 min-w-0 text-sm">
                                            <p className="text-white truncate">{i.nombre}</p>
                                            <p className="text-[10px] text-slate-500 font-mono">{i.unidad} · ${fmtPrecio(i.precio_venta)} c/u</p>
                                        </div>
                                        <button type="button" onClick={() => quitarProducto(i.producto_id)} className="text-slate-500 hover:text-red-500 p-1.5">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</label>
                            <select
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1 text-sm"
                                value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                            >
                                <option value="precio_combo">Precio del combo</option>
                                <option value="descuento">Descuento en pesos</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {form.tipo === 'precio_combo' ? 'Precio total ($)' : 'Descuento ($)'}
                            </label>
                            <input
                                type="number" step="0.0001" min="0" required placeholder="0.00"
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                                value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                            />
                        </div>
                    </div>

                    {form.items.length > 0 && form.valor !== '' && (
                        <div className={`p-3 rounded-xl border text-xs font-bold ${ahorro > 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            <div className="flex justify-between"><span>Precio normal</span><span className="font-mono">${precioNormal.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Precio con promoción</span><span className="font-mono">${Math.max(precioFinal, 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>El cliente ahorra</span><span className="font-mono">${ahorro.toFixed(2)}</span></div>
                            {ahorro <= 0 && <p className="mt-1 uppercase text-[10px]">Con estos valores el combo no ahorra nada</p>}
                        </div>
                    )}

                    <button
                        type="submit" disabled={guardando}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-slate-900 font-black py-3 rounded-xl uppercase tracking-widest transition-all"
                    >
                        {guardando ? 'Guardando...' : 'Crear promoción'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PromotionsPage;
