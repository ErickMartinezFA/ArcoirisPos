import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Filter, AlertTriangle } from 'lucide-react';

const InventoryPage = () => {
    const [data, setData] = useState([]);
    const [filtroNombre, setFiltroNombre] = useState('');
    const [filtroSucursal, setFiltroSucursal] = useState('TODAS');

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const res = await api.get('/inventory/report');
                // Al recibir los datos, nos aseguramos que stock_actual sea número
                const cleanData = res.data.map(item => ({
                    ...item,
                    stock_actual: Number(item.stock_actual) || 0
                }));
                setData(cleanData);
            } catch (err) {
                console.error("Error al cargar inventario:", err);
            }
        };
        fetchInventory();
    }, []);

    // Lógica de filtrado
    const inventarioFiltrado = data.filter(item => {
        const nombre = item.producto || '';
        const codigo = item.codigo_barras || '';
        const sucursal = item.sucursal || '';

        const coincideNombre = nombre.toLowerCase().includes(filtroNombre.toLowerCase()) || 
                               codigo.includes(filtroNombre);
        const coincideSucursal = filtroSucursal === 'TODAS' || sucursal === filtroSucursal;
        
        return coincideNombre && coincideSucursal;
    });

    const sucursalesUnicas = [...new Set(data.map(item => item.sucursal).filter(Boolean))];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                    Control de Existencias Global
                </h2>
                
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        <input 
                            type="text"
                            placeholder="Buscar producto o código..."
                            className="bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-white outline-none focus:border-yellow-500 w-64"
                            value={filtroNombre}
                            onChange={(e) => setFiltroNombre(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3">
                        <Filter size={16} className="text-slate-500" />
                        <select 
                            className="bg-transparent text-white py-2 outline-none text-sm font-bold"
                            value={filtroSucursal}
                            onChange={(e) => setFiltroSucursal(e.target.value)}
                        >
                            <option value="TODAS">TODAS LAS SUCURSALES</option>
                            {sucursalesUnicas.map(suc => (
                                <option key={suc} value={suc}>{suc}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th className="p-4 border-b border-slate-700">Cód. Barras</th>
                            <th className="p-4 border-b border-slate-700">Producto</th>
                            <th className="p-4 border-b border-slate-700 text-center">Sucursal</th>
                            <th className="p-4 border-b border-slate-700 text-right">Existencia</th>
                            <th className="p-4 border-b border-slate-700 text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60">
                        {inventarioFiltrado.map((item) => (
                            <tr key={`${item.producto_id}-${item.sucursal}`} className="hover:bg-slate-700/20 transition-colors">
                                <td className="px-4 py-5 font-mono text-slate-500 text-sm">{item.codigo_barras || '—'}</td>
                                <td className="px-4 py-5">
                                    <div className="font-bold text-white">{item.producto}</div>
                                    <div className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">{item.unidad}</div>
                                </td>
                                <td className="px-4 py-5 text-center">
                                    <span className="bg-slate-900 text-slate-300 px-3 py-1.5 rounded-full text-[10px] font-black border border-slate-700/60">
                                        {item.sucursal || 'SIN ASIGNAR'}
                                    </span>
                                </td>
                                <td className="px-4 py-5 text-right">
                                    <span className={`text-xl font-black ${item.stock_actual <= 5 ? 'text-red-400' : 'text-green-400'}`}>
                                        {item.stock_actual}
                                    </span>
                                </td>
                                <td className="px-4 py-5 text-center">
                                    {item.stock_actual <= 5 ? (
                                        <span className="inline-flex items-center gap-1.5 text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full">
                                            <AlertTriangle size={11} />
                                            <span className="text-[10px] font-black uppercase">Stock Bajo</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                                            <span className="text-[10px] font-black uppercase">Óptimo</span>
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {inventarioFiltrado.length === 0 && (
                    <div className="p-12 text-center text-slate-500 uppercase text-xs font-bold tracking-widest italic">
                        No se encontraron registros en el inventario global
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryPage;