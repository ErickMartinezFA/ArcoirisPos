import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../api';
import { fmtPrecio } from '../precio';

const ReturnsPage = () => {
    const [searchParams] = useSearchParams();
    const [folio, setFolio] = useState(searchParams.get('venta') || '');
    const [venta, setVenta] = useState(null);
    const [cantidades, setCantidades] = useState({}); // detalle_id -> string
    const [motivo, setMotivo] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState({ texto: '', error: false });

    const avisar = (texto, error = false) => setMensaje({ texto, error });

    const buscar = async (folioBuscado) => {
        const id = (folioBuscado ?? folio).trim();
        if (!id) return;
        setBuscando(true);
        avisar('');
        setVenta(null);
        setCantidades({});
        try {
            const { data } = await api.get(`/devoluciones/venta/${id}`);
            setVenta(data);
        } catch (err) {
            avisar(err.response?.data?.error || 'No se pudo buscar esa venta', true);
        } finally {
            setBuscando(false);
        }
    };

    useEffect(() => {
        if (searchParams.get('venta')) buscar(searchParams.get('venta'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalADevolver = venta
        ? venta.items.reduce((s, i) => {
            const cant = parseFloat(cantidades[i.detalle_id]) || 0;
            return s + cant * Number(i.precio_unitario);
        }, 0)
        : 0;

    const confirmar = async () => {
        if (!venta || guardando) return;
        const items = venta.items
            .map(i => ({ detalle_id: i.detalle_id, cantidad: parseFloat(cantidades[i.detalle_id]) || 0 }))
            .filter(i => i.cantidad > 0);

        if (items.length === 0) return avisar('Indica cuántas piezas se devuelven de al menos un producto', true);
        if (!motivo.trim()) return avisar('Escribe el motivo de la devolución', true);
        for (const i of items) {
            const linea = venta.items.find(v => v.detalle_id === i.detalle_id);
            if (i.cantidad > linea.disponible) {
                return avisar(`"${linea.nombre}": solo hay ${linea.disponible} disponibles para devolver`, true);
            }
        }

        setGuardando(true);
        try {
            const { data } = await api.post('/devoluciones', { venta_id: venta.venta_id, motivo: motivo.trim(), items });
            avisar(`Devolución registrada por $${Number(data.total).toFixed(2)}. El stock ya se actualizó.`);
            setVenta(null);
            setCantidades({});
            setMotivo('');
            setFolio('');
        } catch (err) {
            avisar(err.response?.data?.error || 'No se pudo procesar la devolución', true);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
                <RotateCcw className="text-yellow-500" size={26} /> Cambios y Devoluciones
            </h2>

            {mensaje.texto && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold border flex items-center gap-2 ${
                    mensaje.error
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                    {mensaje.error ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    {mensaje.texto}
                </div>
            )}

            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Folio del ticket</label>
                <div className="flex gap-2 mt-1">
                    <input
                        type="number" placeholder="Ej. 42"
                        className="flex-1 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-yellow-500"
                        value={folio}
                        onChange={e => setFolio(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && buscar()}
                    />
                    <button onClick={() => buscar()} disabled={buscando}
                        className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-slate-900 font-black px-5 rounded-xl flex items-center gap-2 transition-all">
                        <Search size={16} /> {buscando ? 'Buscando...' : 'Buscar'}
                    </button>
                </div>
            </div>

            {venta && (
                <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <p className="font-black text-white">Ticket #{venta.venta_id}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                                {new Date(venta.fecha).toLocaleString('es-MX')} · {venta.vendedor} · {venta.sucursal} · <span className="uppercase">{venta.metodo_pago}</span>
                            </p>
                        </div>
                        <p className="text-lg font-black text-green-400 font-mono">${Number(venta.total).toFixed(2)}</p>
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <tr>
                                <th className="p-4">Producto</th>
                                <th className="p-4 text-center">Vendido</th>
                                <th className="p-4 text-center">Disponible</th>
                                <th className="p-4 w-32">A devolver</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/60">
                            {venta.items.map(i => (
                                <tr key={i.detalle_id} className={i.disponible <= 0 ? 'opacity-40' : ''}>
                                    <td className="p-4">
                                        <p className="font-bold text-white text-sm">{i.nombre}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">{i.unidad} · ${fmtPrecio(i.precio_unitario)} c/u</p>
                                    </td>
                                    <td className="p-4 text-center font-mono text-slate-300">{i.cantidad}</td>
                                    <td className="p-4 text-center font-mono text-slate-300">{i.disponible}</td>
                                    <td className="p-4">
                                        <input
                                            type="number" min="0" max={i.disponible}
                                            step={i.unidad === 'PZ' ? '1' : '0.01'}
                                            disabled={i.disponible <= 0}
                                            placeholder="0"
                                            className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-yellow-500 font-black text-center outline-none focus:border-yellow-500 disabled:opacity-40"
                                            value={cantidades[i.detalle_id] || ''}
                                            onChange={e => setCantidades({ ...cantidades, [i.detalle_id]: e.target.value })}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="p-6 space-y-4 border-t border-slate-700">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motivo de la devolución</label>
                            <textarea
                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white h-20 outline-none focus:border-yellow-500 mt-1"
                                placeholder="Ej. Producto equivocado, el cliente pidió otra medida..."
                                value={motivo} onChange={e => setMotivo(e.target.value)}
                            />
                        </div>

                        {totalADevolver > 0 && (
                            <div className="flex justify-between items-center bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <span className="text-xs font-black text-red-400 uppercase tracking-widest">Total a reembolsar</span>
                                <span className="text-2xl font-black text-red-400 font-mono">${totalADevolver.toFixed(2)}</span>
                            </div>
                        )}

                        <button onClick={confirmar} disabled={guardando}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all">
                            {guardando ? 'Procesando...' : 'Confirmar Devolución'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnsPage;
