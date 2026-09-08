import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Package, MapPin, Plus } from 'lucide-react';

const StockEntryPage = () => {
    const [productos, setProductos] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [formData, setFormData] = useState({ sucursal_id: '', cantidad: '' });
    const [mensaje, setMensaje] = useState('');

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
                setMensaje('Error al cargar datos');
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
        if (!productoSeleccionado || !formData.cantidad) return;
        try {
            await api.put('/inventory/add', {
                producto_id: productoSeleccionado.producto_id,
                sucursal_id: formData.sucursal_id,
                cantidad: Number(formData.cantidad),
            });
            setMensaje(`+${formData.cantidad} unidades cargadas a "${productoSeleccionado.nombre}"`);
            setFormData(f => ({ ...f, cantidad: '' }));
            setProductoSeleccionado(null);
        } catch (err) {
            setMensaje(err.response?.data?.error || 'Error al actualizar stock');
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {mensaje && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm font-bold">
                    {mensaje}
                </div>
            )}

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <h2 className="text-xl font-black text-green-500 mb-6 flex items-center gap-2 uppercase italic">
                    <Plus size={24} /> Gestión de Entradas de Almacén
                </h2>

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
                                                    onClick={() => { setProductoSeleccionado(p); setMensaje(''); }}
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
                            <Package size={16} /> PANEL DE CARGA
                        </h3>

                        {productoSeleccionado ? (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20">
                                    <p className="text-[10px] text-green-500 font-bold uppercase">Producto Activo</p>
                                    <p className="text-lg font-black text-white">{productoSeleccionado.nombre}</p>
                                    <p className="text-xs font-mono text-slate-500 mt-1">{productoSeleccionado.codigo_barras}</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                                        <MapPin size={12} /> Sucursal Destino
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
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Cantidad a Ingresar</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white text-2xl font-black focus:border-green-500 outline-none"
                                        value={formData.cantidad}
                                        onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                                        placeholder="0"
                                        required
                                    />
                                </div>

                                <button type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-black p-4 rounded-xl shadow-xl shadow-green-900/20 transition-all uppercase tracking-widest italic">
                                    Confirmar Entrada
                                </button>
                                <button type="button" onClick={() => setProductoSeleccionado(null)} className="w-full text-slate-500 font-bold text-[10px] uppercase tracking-tighter hover:text-slate-400">
                                    Cancelar Selección
                                </button>
                            </form>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-600 border-2 border-slate-800 border-dashed rounded-xl">
                                <Package size={48} className="mb-4 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest px-4">Selecciona un producto de la tabla para iniciar la carga</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockEntryPage;
