import { useState, useEffect, useRef } from 'react';
import { Search, PlusCircle, Edit3, X, Sparkles, AlertCircle, Loader } from 'lucide-react';
import api from '../api';

const FORM_VACIO = {
    codigo_barras: '',
    nombre: '',
    precio_venta: '',
    precio_compra: '',
    unidad: 'PZ',
    descripcion: '',
    sucursal_id: '',
    stock_inicial: '0',
};

const AddProductPage = () => {
    const [sucursales, setSucursales] = useState([]);
    const [productos, setProductos] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [formData, setFormData] = useState(FORM_VACIO);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [productoEditandoId, setProductoEditandoId] = useState(null);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
    const [sugerencia, setSugerencia] = useState(null); // { nombre, descripcion } | 'not_found' | 'loading'
    const barcodeTimer = useRef(null);

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [resSuc, resProd] = await Promise.all([
                api.get('/sucursales'),
                api.get('/products'),
            ]);
            setSucursales(resSuc.data);
            setProductos(resProd.data);
            if (resSuc.data.length > 0) {
                setFormData(prev => ({ ...prev, sucursal_id: resSuc.data[0].sucursal_id }));
            }
        } catch {
            mostrarMensaje('Error al cargar datos', 'error');
        }
    };

    const mostrarMensaje = (texto, tipo = 'ok') => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 3500);
    };

    const cargarProductoEnFormulario = (p) => {
        setFormData({
            codigo_barras: p.codigo_barras || '',
            nombre: p.nombre || '',
            precio_venta: p.precio_venta || '',
            precio_compra: p.precio_compra || '',
            unidad: p.unidad || 'PZ',
            descripcion: p.descripcion || '',
            sucursal_id: formData.sucursal_id,
            stock_inicial: '0',
        });
        setProductoEditandoId(p.producto_id);
        setModoEdicion(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicion = () => {
        setModoEdicion(false);
        setProductoEditandoId(null);
        setFormData(prev => ({ ...FORM_VACIO, sucursal_id: prev.sucursal_id }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modoEdicion) {
                await api.put(`/products/${productoEditandoId}`, formData);
                mostrarMensaje(`"${formData.nombre}" actualizado correctamente`);
                cancelarEdicion();
            } else {
                await api.post('/products', formData);
                mostrarMensaje(`"${formData.nombre}" registrado correctamente`);
                setFormData(prev => ({ ...FORM_VACIO, sucursal_id: prev.sucursal_id }));
            }
            cargarDatos();
        } catch {
            mostrarMensaje('Error al guardar el producto', 'error');
        }
    };

    const field = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

    const buscarCodigoBarras = (codigo) => {
        field('codigo_barras', codigo);
        setSugerencia(null);
        clearTimeout(barcodeTimer.current);
        if (codigo.length < 6) return;
        barcodeTimer.current = setTimeout(async () => {
            setSugerencia('loading');
            try {
                const { data } = await api.get(`/auth/barcode/${codigo}`);
                if (data.found) {
                    setSugerencia({ nombre: data.nombre, descripcion: data.descripcion });
                } else {
                    setSugerencia('not_found');
                }
            } catch {
                setSugerencia('not_found');
            }
        }, 600);
    };

    const aplicarSugerencia = () => {
        if (!sugerencia || sugerencia === 'loading' || sugerencia === 'not_found') return;
        field('nombre', sugerencia.nombre);
        field('descripcion', sugerencia.descripcion);
        setSugerencia(null);
    };

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        (p.codigo_barras || '').includes(filtro)
    );

    return (
        <div className="space-y-8 max-w-5xl">

            {/* Formulario */}
            <div className={`bg-slate-800 p-8 rounded-2xl border shadow-2xl transition-colors ${modoEdicion ? 'border-yellow-500/40' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className={`text-2xl font-black italic uppercase tracking-tighter ${modoEdicion ? 'text-yellow-400' : 'text-yellow-500'}`}>
                        {modoEdicion ? (
                            <span className="flex items-center gap-2"><Edit3 size={22} /> Editando Producto</span>
                        ) : (
                            <span className="flex items-center gap-2"><PlusCircle size={22} /> Registro de Producto</span>
                        )}
                    </h2>
                    {modoEdicion && (
                        <button onClick={cancelarEdicion}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest border border-slate-600 hover:border-slate-500 px-3 py-2 rounded-lg transition-all">
                            <X size={13} /> Cancelar edición
                        </button>
                    )}
                </div>

                {mensaje.texto && (
                    <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-bold border ${
                        mensaje.tipo === 'error'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                    }`}>
                        {mensaje.texto}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre del Producto</label>
                        <input type="text" required placeholder="Ej. Martillo de Carpintero 16oz"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 transition-all mt-1"
                            value={formData.nombre} onChange={e => field('nombre', e.target.value)} />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código de Barras</label>
                        <input type="text"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                            value={formData.codigo_barras}
                            onChange={e => buscarCodigoBarras(e.target.value)}
                            placeholder="Escanea o escribe el código" />

                        {sugerencia === 'loading' && (
                            <div className="mt-2 flex items-center gap-2 text-slate-400 text-xs font-bold">
                                <Loader size={13} className="animate-spin" /> Buscando en base de datos pública...
                            </div>
                        )}

                        {sugerencia === 'not_found' && (
                            <div className="mt-2 flex items-center gap-2 text-slate-500 text-xs font-bold">
                                <AlertCircle size={13} /> Producto no encontrado en base de datos — ingresa los datos manualmente.
                            </div>
                        )}

                        {sugerencia && sugerencia !== 'loading' && sugerencia !== 'not_found' && (
                            <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Sparkles size={14} className="text-yellow-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Datos sugeridos</p>
                                            <p className="text-white text-sm font-bold truncate">{sugerencia.nombre}</p>
                                            {sugerencia.descripcion && <p className="text-slate-400 text-xs truncate">{sugerencia.descripcion}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button type="button" onClick={aplicarSugerencia}
                                            className="text-[10px] font-black uppercase tracking-widest bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-3 py-1.5 rounded-lg transition-colors">
                                            Aplicar
                                        </button>
                                        <button type="button" onClick={() => setSugerencia(null)}
                                            className="text-slate-500 hover:text-white transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unidad de Medida</label>
                        <select className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                            value={formData.unidad} onChange={e => field('unidad', e.target.value)}>
                            <option value="PZ">Pieza (PZ)</option>
                            <option value="KG">Kilogramo (KG)</option>
                            <option value="MT">Metro (MT)</option>
                            <option value="LT">Litro (LT)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio Compra ($)</label>
                        <input type="number" step="0.01"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                            value={formData.precio_compra} onChange={e => field('precio_compra', e.target.value)} />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio Venta ($)</label>
                        <input type="number" step="0.01" required
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                            value={formData.precio_venta} onChange={e => field('precio_venta', e.target.value)} />
                    </div>

                    {/* Sección de inventario inicial solo visible al crear */}
                    {!modoEdicion && (
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-yellow-500/20 col-span-2 grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <span className="text-[11px] font-black text-yellow-500 uppercase">Inventario Inicial</span>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Sucursal de Entrada</label>
                                <select required
                                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-yellow-500 outline-none mt-1"
                                    value={formData.sucursal_id} onChange={e => field('sucursal_id', e.target.value)}>
                                    {sucursales.map(s => (
                                        <option key={s.sucursal_id} value={s.sucursal_id}>{s.Nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Stock Inicial</label>
                                <input type="number"
                                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500 mt-1"
                                    value={formData.stock_inicial} onChange={e => field('stock_inicial', e.target.value)} />
                            </div>
                        </div>
                    )}

                    <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descripción</label>
                        <textarea
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white h-20 outline-none focus:border-yellow-500 mt-1"
                            value={formData.descripcion} onChange={e => field('descripcion', e.target.value)} />
                    </div>

                    <button type="submit"
                        className={`col-span-2 font-black p-4 rounded-xl transition-all uppercase tracking-[0.2em] shadow-lg ${
                            modoEdicion
                                ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-900 shadow-yellow-500/10'
                                : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 shadow-yellow-500/10'
                        }`}>
                        {modoEdicion ? 'Guardar Cambios' : 'Registrar Producto e Inventario'}
                    </button>
                </form>
            </div>

            {/* Lista de productos existentes */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-widest">
                        Productos registrados <span className="text-slate-500 font-bold">({productosFiltrados.length})</span>
                    </span>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            className="bg-slate-900 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-white text-sm outline-none focus:border-yellow-500 transition-colors w-64"
                            value={filtro}
                            onChange={e => setFiltro(e.target.value)}
                        />
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/60 sticky top-0 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <tr>
                                <th className="p-4 border-b border-slate-700">Producto</th>
                                <th className="p-4 border-b border-slate-700">Código</th>
                                <th className="p-4 border-b border-slate-700 text-center">Unidad</th>
                                <th className="p-4 border-b border-slate-700 text-right">P. Compra</th>
                                <th className="p-4 border-b border-slate-700 text-right">P. Venta</th>
                                <th className="p-4 border-b border-slate-700 text-center">Editar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                            {productosFiltrados.map(p => (
                                <tr key={p.producto_id}
                                    className={`transition-colors ${productoEditandoId === p.producto_id ? 'bg-yellow-500/10' : 'hover:bg-slate-700/20'}`}>
                                    <td className="p-4 font-bold text-white">{p.nombre}</td>
                                    <td className="p-4 font-mono text-slate-500 text-sm">{p.codigo_barras || '—'}</td>
                                    <td className="p-4 text-center text-slate-400 text-sm font-bold">{p.unidad}</td>
                                    <td className="p-4 text-right font-mono text-slate-400">${Number(p.precio_compra || 0).toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono font-black text-green-400">${Number(p.precio_venta).toFixed(2)}</td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => cargarProductoEnFormulario(p)}
                                            className={`p-2 rounded-lg transition-colors ${
                                                productoEditandoId === p.producto_id
                                                    ? 'text-yellow-400 bg-yellow-500/10'
                                                    : 'text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10'
                                            }`}
                                            title="Editar producto"
                                        >
                                            <Edit3 size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {productosFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500 italic text-sm">
                                        No se encontraron productos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AddProductPage;
