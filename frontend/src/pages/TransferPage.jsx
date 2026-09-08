import { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import api from '../api';

const TransferPage = () => {
    const [sucursales, setSucursales] = useState([]);
    const [productos, setProductos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [origenId, setOrigenId] = useState('');
    const [destinoId, setDestinoId] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [stockOrigen, setStockOrigen] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [exito, setExito] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([api.get('/sucursales'), api.get('/products')])
            .then(([resSuc, resProd]) => {
                setSucursales(resSuc.data);
                setProductos(resProd.data);
            })
            .catch(() => setError('No se pudieron cargar los datos iniciales.'));
    }, []);

    // Consulta el stock del producto en la sucursal origen cada vez que cambia la selección
    useEffect(() => {
        if (!productoSeleccionado || !origenId) { setStockOrigen(null); return; }

        api.get('/inventory/report').then(res => {
            const entrada = res.data.find(
                r => r.producto_id === productoSeleccionado.producto_id &&
                     Number(r.sucursal_id) === Number(origenId)
            );
            setStockOrigen(entrada ? Number(entrada.stock_actual) : 0);
        }).catch(() => setStockOrigen(null));
    }, [productoSeleccionado, origenId]);

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo_barras || '').includes(busqueda)
    );

    const seleccionarProducto = (p) => {
        setProductoSeleccionado(p);
        setBusqueda(p.nombre);
        setStockOrigen(null);
        setCantidad('');
        setError('');
        setExito(false);
    };

    const handleTransferir = async () => {
        setError('');
        if (!productoSeleccionado || !origenId || !destinoId || !cantidad) {
            return setError('Completa todos los campos antes de transferir.');
        }
        if (Number(origenId) === Number(destinoId)) {
            return setError('El origen y el destino no pueden ser la misma sucursal.');
        }
        const qty = parseInt(cantidad, 10);
        if (!qty || qty <= 0) {
            return setError('La cantidad debe ser un número entero positivo.');
        }

        setCargando(true);
        try {
            await api.post('/inventory/transfer', {
                producto_id: productoSeleccionado.producto_id,
                sucursal_origen_id: Number(origenId),
                sucursal_destino_id: Number(destinoId),
                cantidad: qty,
            });
            setExito(true);
            setCantidad('');
            setBusqueda('');
            setProductoSeleccionado(null);
            setStockOrigen(null);
            setOrigenId('');
            setDestinoId('');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al procesar la transferencia.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                Transferencia Inter-sucursal
            </h2>

            {exito && (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl">
                    <CheckCircle size={16} />
                    <span className="text-sm font-bold">Transferencia registrada con éxito.</span>
                </div>
            )}
            {error && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-bold">{error}</span>
                </div>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">

                {/* Buscar producto */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-yellow-500 transition-colors"
                            value={busqueda}
                            onChange={(e) => {
                                setBusqueda(e.target.value);
                                setProductoSeleccionado(null);
                                setExito(false);
                            }}
                        />
                    </div>

                    {busqueda && !productoSeleccionado && productosFiltrados.length > 0 && (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                            {productosFiltrados.slice(0, 10).map(p => (
                                <button
                                    key={p.producto_id}
                                    onClick={() => seleccionarProducto(p)}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0"
                                >
                                    <p className="text-sm font-bold text-white">{p.nombre}</p>
                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{p.codigo_barras || 'Sin código'}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {productoSeleccionado && (
                        <div className="flex items-center justify-between bg-yellow-400/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                            <div>
                                <p className="text-sm font-black text-yellow-400">{productoSeleccionado.nombre}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{productoSeleccionado.codigo_barras || 'Sin código'}</p>
                            </div>
                            <button
                                onClick={() => { setProductoSeleccionado(null); setBusqueda(''); setStockOrigen(null); }}
                                className="text-slate-500 hover:text-red-400 text-[10px] font-bold uppercase transition-colors"
                            >
                                Cambiar
                            </button>
                        </div>
                    )}
                </div>

                {/* Sucursal Origen */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucursal Origen</label>
                    <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-yellow-500 transition-colors"
                        value={origenId}
                        onChange={(e) => { setOrigenId(e.target.value); setError(''); setExito(false); }}
                    >
                        <option value="">Seleccionar sucursal origen...</option>
                        {sucursales.map(s => (
                            <option key={s.sucursal_id} value={s.sucursal_id}>{s.Nombre}</option>
                        ))}
                    </select>
                    {stockOrigen !== null && (
                        <p className="text-[11px] text-slate-400 font-bold px-1">
                            Stock disponible en origen:{' '}
                            <span className={stockOrigen <= 5 ? 'text-red-400' : 'text-green-400'}>
                                {stockOrigen} {productoSeleccionado?.unidad || ''}
                            </span>
                        </p>
                    )}
                </div>

                {/* Sucursal Destino — la sucursal origen no aparece como opción */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucursal Destino</label>
                    <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-yellow-500 transition-colors"
                        value={destinoId}
                        onChange={(e) => { setDestinoId(e.target.value); setError(''); setExito(false); }}
                    >
                        <option value="">Seleccionar sucursal destino...</option>
                        {sucursales.filter(s => Number(s.sucursal_id) !== Number(origenId)).map(s => (
                            <option key={s.sucursal_id} value={s.sucursal_id}>{s.Nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Cantidad */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad a Transferir</label>
                    <input
                        type="number"
                        min="1"
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-yellow-500 transition-colors"
                        value={cantidad}
                        onChange={(e) => { setCantidad(e.target.value); setError(''); setExito(false); }}
                    />
                </div>

                {/* Resumen visual antes de confirmar */}
                {productoSeleccionado && origenId && destinoId && Number(cantidad) > 0 && (
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
                        <div className="text-center flex-1">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Desde</p>
                            <p className="text-sm font-black text-white">
                                {sucursales.find(s => Number(s.sucursal_id) === Number(origenId))?.Nombre}
                            </p>
                        </div>
                        <div className="flex flex-col items-center text-yellow-400">
                            <ArrowRightLeft size={18} />
                            <span className="text-[10px] font-black mt-1">{cantidad}</span>
                        </div>
                        <div className="text-center flex-1">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Hacia</p>
                            <p className="text-sm font-black text-white">
                                {sucursales.find(s => Number(s.sucursal_id) === Number(destinoId))?.Nombre}
                            </p>
                        </div>
                    </div>
                )}

                <button
                    onClick={handleTransferir}
                    disabled={cargando}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black text-sm uppercase tracking-widest py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    {cargando ? (
                        <><Loader size={16} className="animate-spin" /> Procesando...</>
                    ) : (
                        <><ArrowRightLeft size={16} /> Confirmar Transferencia</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default TransferPage;
