import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Package, MapPin, Plus, Minus } from 'lucide-react';

const MOTIVOS = ['Corrección de captura', 'Merma o daño', 'Faltante', 'Otro'];

const StockEntryPage = () => {
    const [productos, setProductos] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [modo, setModo] = useState('entrada'); // 'entrada' suma piezas, 'salida' las descuenta
    const [motivo, setMotivo] = useState(MOTIVOS[0]);
    const [formData, setFormData] = useState({ sucursal_id: '', cantidad: '' });
    const [mensaje, setMensaje] = useState('');
    const [esError, setEsError] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const avisar = (texto, error = false) => { setMensaje(texto); setEsError(error); };

    useEffect(() => {
        const loadData = async () => {
            try {
                const [resProd, resSuc] = await Promise.all([
                    api.get('/products'),
                    api.get('/sucursales'),
                ]);
                setProductos(resProd.data);
                setSucursales(resSuc.data);
                if (resSuc.data.length > 0) {
                    setFormData(f => ({ ...f, sucursal_id: resSuc.data[0].sucursal_id }));
                }
            } catch {
                avisar('No se pudieron cargar los productos. Recarga la página.', true);
            }
        };
        loadData();
    }, []);

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        (p.codigo_barras || '').includes(filtro)
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!productoSeleccionado || !formData.cantidad || guardando) return;
        const cantidad = Number(formData.cantidad);
        if (!(cantidad > 0)) return avisar('La cantidad debe ser mayor a 0', true);
        if (productoSeleccionado.unidad === 'PZ' && !Number.isInteger(cantidad)) {
            return avisar('Los productos por pieza solo admiten cantidades enteras', true);
        }
        setGuardando(true);
        try {
            const esSalida = modo === 'salida';
            await api.put(esSalida ? '/inventory/remove' : '/inventory/add', {
                producto_id: productoSeleccionado.producto_id,
                sucursal_id: formData.sucursal_id,
                cantidad,
                ...(esSalida && { motivo }),
            });
            const nombreSuc = sucursales.find(s => Number(s.sucursal_id) === Number(formData.sucursal_id))?.Nombre || '';
            const sufijo = `"${productoSeleccionado.nombre}"${nombreSuc ? ` (${nombreSuc})` : ''}`;
            avisar(esSalida
                ? `-${cantidad} ${productoSeleccionado.unidad} descontadas de ${sufijo}`
                : `+${cantidad} ${productoSeleccionado.unidad} cargadas a ${sufijo}`);
            setFormData(f => ({ ...f, cantidad: '' }));
            setProductoSeleccionado(null);
        } catch (err) {
            avisar(err.response?.data?.error || 'No se pudo actualizar el stock. Intenta de nuevo.', true);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {mensaje && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold border ${
                    esError
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                    {mensaje}
                </div>
            )}

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h2 className={`text-xl font-black flex items-center gap-2 uppercase italic ${modo === 'salida' ? 'text-red-500' : 'text-green-500'}`}>
                        {modo === 'salida' ? <Minus size={24} /> : <Plus size={24} />} {modo === 'salida' ? 'Descuento Manual de Piezas' : 'Gestión de Entradas de Almacén'}
                    </h2>
                    <div className="flex rounded-xl border border-slate-700 overflow-hidden text-xs font-black uppercase tracking-wider">
                        <button
                            type="button" onClick={() => { setModo('entrada'); avisar(''); }}
                            className={`px-4 py-2 transition-colors ${modo === 'entrada' ? 'bg-green-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                        >
                            Entrada
                        </button>
                        <button
                            type="button" onClick={() => { setModo('salida'); avisar(''); }}
                            className={`px-4 py-2 transition-colors ${modo === 'salida' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
                        >
                            Descontar
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={18} />
                            <input
                                type="text"
                                placeholder="Filtrar por nombre o código de barras..."
                                className="w-full pl-10 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-green-500 transition-all"
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                            />
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50 max-h-[400px] overflow-y-auto">
                            <table className="w-full text-left text-xs uppercase tracking-wider font-bold">
                                <thead className="bg-slate-800 text-slate-400 sticky top-0">
                                    <tr>
                                        <th className="p-4">Cód. Barras</th>
                                        <th className="p-4">Producto</th>
                                        <th className="p-4">Unidad</th>
                                        <th className="p-4 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {productosFiltrados.map(p => (
                                        <tr
                                            key={p.producto_id}
                                            className={`hover:bg-slate-700/30 transition-colors ${productoSeleccionado?.producto_id === p.producto_id ? 'bg-green-500/10 text-green-400' : 'text-slate-300'}`}
                                        >
                                            <td className="p-4 font-mono">{p.codigo_barras}</td>
                                            <td className="p-4">{p.nombre}</td>
                                            <td className="p-4">{p.unidad}</td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => { setProductoSeleccionado(p); avisar(''); }}
                                                    className={`px-3 py-1.5 rounded-lg border transition-all ${
                                                        productoSeleccionado?.producto_id === p.producto_id
                                                            ? 'bg-green-500 border-green-500 text-slate-900'
                                                            : 'border-slate-600 hover:border-green-500 hover:text-green-500'
                                                    }`}
                                                >
                                                    {productoSeleccionado?.producto_id === p.producto_id ? 'SELECCIONADO' : 'ELEGIR'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 border-dashed">
                        <h3 className="text-sm font-black text-slate-400 mb-6 flex items-center gap-2">
                            <Package size={16} /> {modo === 'salida' ? 'PANEL DE DESCUENTO' : 'PANEL DE CARGA'}
                        </h3>

                        {productoSeleccionado ? (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className={`p-4 rounded-xl border ${modo === 'salida' ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                    <p className={`text-[10px] font-bold uppercase ${modo === 'salida' ? 'text-red-500' : 'text-green-500'}`}>Producto Activo</p>
                                    <p className="text-lg font-black text-white">{productoSeleccionado.nombre}</p>
                                    <p className="text-xs font-mono text-slate-500 mt-1">{productoSeleccionado.codigo_barras}</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                                        <MapPin size={12} /> {modo === 'salida' ? 'Sucursal' : 'Sucursal Destino'}
                                    </label>
                                    <select
                                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-green-500"
                                        value={formData.sucursal_id}
                                        onChange={(e) => setFormData({ ...formData, sucursal_id: e.target.value })}
                                    >
                                        {sucursales.map(s => (
                                            <option key={s.sucursal_id} value={s.sucursal_id}>{s.Nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">{modo === 'salida' ? 'Cantidad a Descontar' : 'Cantidad a Ingresar'} ({productoSeleccionado.unidad})</label>
                                    <input
                                        type="number"
                                        min={productoSeleccionado.unidad === "PZ" ? "1" : "0.01"}
                                        step={productoSeleccionado.unidad === "PZ" ? "1" : "any"}
                                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-2xl font-black focus:border-green-500 outline-none"
                                        value={formData.cantidad}
                                        onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                                        placeholder="0"
                                        required
                                    />
                                </div>

                                {modo === 'salida' && (
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Motivo</label>
                                        <select
                                            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-red-500"
                                            value={motivo}
                                            onChange={(e) => setMotivo(e.target.value)}
                                        >
                                            {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                )}

                                <button type="submit" disabled={guardando} className={`w-full disabled:opacity-50 disabled:cursor-not-allowed text-white font-black p-4 rounded-xl shadow-xl transition-all uppercase tracking-widest italic ${
                                    modo === 'salida' ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'
                                }`}>
                                    {guardando ? 'Guardando...' : modo === 'salida' ? 'Confirmar Descuento' : 'Confirmar Entrada'}
                                </button>
                                <button type="button" onClick={() => setProductoSeleccionado(null)} className="w-full text-slate-500 font-bold text-[10px] uppercase tracking-tighter hover:text-slate-400">
                                    Cancelar Selección
                                </button>
                            </form>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-600 border-2 border-slate-800 border-dashed rounded-xl">
                                <Package size={48} className="mb-4 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest px-4">{modo === 'salida' ? 'Selecciona el producto al que vas a descontar piezas' : 'Selecciona un producto de la tabla para iniciar la carga'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockEntryPage;
