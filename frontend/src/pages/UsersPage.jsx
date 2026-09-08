import { useState, useEffect } from "react";
import { Users, Award, TrendingUp, UserPlus, Trash2, Key, X, Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";
import api from "../api";

// Evalúa la fortaleza de la contraseña y devuelve { nivel, color, texto }
const evaluarPassword = (pwd) => {
    if (!pwd) return null;
    let puntos = 0;
    if (pwd.length >= 8) puntos++;
    if (pwd.length >= 12) puntos++;
    if (/[A-Z]/.test(pwd)) puntos++;
    if (/[0-9]/.test(pwd)) puntos++;
    if (/[^A-Za-z0-9]/.test(pwd)) puntos++;

    if (puntos <= 1) return { nivel: 1, color: 'bg-red-500', texto: 'Muy débil', textColor: 'text-red-400' };
    if (puntos === 2) return { nivel: 2, color: 'bg-orange-500', texto: 'Débil', textColor: 'text-orange-400' };
    if (puntos === 3) return { nivel: 3, color: 'bg-yellow-500', texto: 'Regular', textColor: 'text-yellow-400' };
    if (puntos === 4) return { nivel: 4, color: 'bg-blue-500', texto: 'Fuerte', textColor: 'text-blue-400' };
    return { nivel: 5, color: 'bg-green-500', texto: 'Muy fuerte', textColor: 'text-green-400' };
};

const ModalResetPassword = ({ usuario, onClose, onSuccess }) => {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [verNueva, setVerNueva] = useState(false);
    const [verConfirm, setVerConfirm] = useState(false);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const fuerza = evaluarPassword(newPass);
    const coinciden = newPass && confirmPass && newPass === confirmPass;
    const noCoinciden = confirmPass && newPass !== confirmPass;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPass.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
        if (!fuerza || fuerza.nivel < 2) return setError('La contraseña es demasiado débil.');
        if (newPass !== confirmPass) return setError('Las contraseñas no coinciden.');

        setCargando(true);
        try {
            await api.put(`/users/${usuario.usuario_id}/reset-password`, { newPassword: newPass });
            onSuccess(`Contraseña de ${usuario.username} actualizada correctamente.`);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al actualizar la contraseña.');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
                    <div>
                        <p className="text-xs font-black text-yellow-400 uppercase tracking-widest">Cambiar Contraseña</p>
                        <p className="text-xs text-slate-500 mt-0.5">{usuario.username}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {/* Nueva contraseña */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nueva Contraseña</label>
                        <div className="relative">
                            <input
                                type={verNueva ? 'text' : 'password'}
                                required
                                placeholder="Mínimo 8 caracteres"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 pr-10 text-white text-sm outline-none focus:border-yellow-500 transition-colors"
                                value={newPass}
                                onChange={(e) => { setNewPass(e.target.value); setError(''); }}
                            />
                            <button type="button" onClick={() => setVerNueva(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                {verNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        {/* Barra de fortaleza */}
                        {newPass && fuerza && (
                            <div className="space-y-1.5">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= fuerza.nivel ? fuerza.color : 'bg-slate-700'}`} />
                                    ))}
                                </div>
                                <p className={`text-[10px] font-bold ${fuerza.textColor}`}>{fuerza.texto}</p>
                            </div>
                        )}

                        {/* Requisitos */}
                        {newPass && (
                            <ul className="space-y-1 mt-2">
                                {[
                                    { ok: newPass.length >= 8, texto: 'Mínimo 8 caracteres' },
                                    { ok: /[A-Z]/.test(newPass), texto: 'Al menos una mayúscula' },
                                    { ok: /[0-9]/.test(newPass), texto: 'Al menos un número' },
                                    { ok: /[^A-Za-z0-9]/.test(newPass), texto: 'Al menos un símbolo (!@#...)' },
                                ].map(({ ok, texto }) => (
                                    <li key={texto} className={`text-[10px] font-bold flex items-center gap-1.5 ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                                        {ok ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />} {texto}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Confirmar contraseña */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmar Contraseña</label>
                        <div className="relative">
                            <input
                                type={verConfirm ? 'text' : 'password'}
                                required
                                placeholder="Repite la contraseña"
                                className={`w-full bg-slate-900 border rounded-xl py-3 px-4 pr-10 text-white text-sm outline-none transition-colors ${
                                    noCoinciden ? 'border-red-500 focus:border-red-500' :
                                    coinciden ? 'border-green-500 focus:border-green-500' :
                                    'border-slate-700 focus:border-yellow-500'
                                }`}
                                value={confirmPass}
                                onChange={(e) => { setConfirmPass(e.target.value); setError(''); }}
                            />
                            <button type="button" onClick={() => setVerConfirm(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                {verConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        {noCoinciden && <p className="text-[10px] text-red-400 font-bold">Las contraseñas no coinciden</p>}
                        {coinciden && <p className="text-[10px] text-green-400 font-bold">Las contraseñas coinciden</p>}
                    </div>

                    {error && (
                        <p className="text-[11px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 font-bold py-3 rounded-xl text-sm transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={cargando || !coinciden}
                            className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-black py-3 rounded-xl text-sm transition-all">
                            {cargando ? 'Guardando...' : 'Actualizar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const UsersPage = () => {
    const [usersInfo, setUsersInfo] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newUser, setNewUser] = useState({ username: "", password: "", rol: "operador" });
    const [usuarioAResetear, setUsuarioAResetear] = useState(null);
    const [mensajeExito, setMensajeExito] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmarEliminar, setConfirmarEliminar] = useState(null);

    const mostrarError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); };

    const loadUsers = async () => {
        try {
            const res = await api.get('/reports/users-sales');
            setUsersInfo(res.data);
        } catch {
            mostrarError("No se pudieron cargar los usuarios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', newUser);
            setMensajeExito('Usuario creado con éxito');
            setNewUser({ username: "", password: "", rol: "operador" });
            setShowForm(false);
            loadUsers();
        } catch (error) {
            mostrarError(error.response?.data?.error || "Error al crear usuario");
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/users/${id}`);
            setConfirmarEliminar(null);
            loadUsers();
        } catch (error) {
            mostrarError(error.response?.data?.error || "Error al eliminar");
        }
    };

    const handleResetSuccess = (msg) => {
        setMensajeExito(msg);
        setTimeout(() => setMensajeExito(''), 4000);
    };

    if (loading) {
        return <div className="text-white text-center mt-20 font-black animate-pulse">Cargando panel de control...</div>;
    }

    return (
        <div className="space-y-6 relative">
            {usuarioAResetear && (
                <ModalResetPassword
                    usuario={usuarioAResetear}
                    onClose={() => setUsuarioAResetear(null)}
                    onSuccess={handleResetSuccess}
                />
            )}

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Users className="text-yellow-500" size={32} />
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                        Control de Operadores
                    </h2>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-green-900/20"
                >
                    {showForm ? <X size={18} /> : <UserPlus size={18} />}
                    {showForm ? "Cancelar" : "Nuevo Usuario"}
                </button>
            </div>

            {mensajeExito && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm font-bold">
                    {mensajeExito}
                </div>
            )}

            {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm font-bold">
                    {errorMsg}
                </div>
            )}

            {confirmarEliminar && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <p className="text-xs font-black text-red-400 uppercase tracking-widest">Confirmar eliminación</p>
                        <p className="text-white text-sm">¿Eliminar al usuario <span className="font-black text-yellow-400">{confirmarEliminar.username}</span>? Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setConfirmarEliminar(null)}
                                className="flex-1 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 font-bold py-3 rounded-xl text-sm transition-all">
                                Cancelar
                            </button>
                            <button onClick={() => handleDelete(confirmarEliminar.usuario_id)}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl text-sm transition-all">
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <form onSubmit={handleCreateUser} className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-inner grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Usuario</label>
                        <input type="text" required
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-yellow-500 outline-none"
                            value={newUser.username}
                            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Contraseña</label>
                        <input type="password" required
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-yellow-500 outline-none"
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Rol</label>
                        <select
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:border-yellow-500 outline-none"
                            value={newUser.rol}
                            onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}>
                            <option value="operador">Operador</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black uppercase tracking-widest rounded-lg py-2 transition-colors">
                            Guardar
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-900/50 text-slate-400 text-xs font-black uppercase tracking-widest">
                        <tr>
                            <th className="p-4 border-b border-slate-700">Ranking</th>
                            <th className="p-4 border-b border-slate-700">Operador</th>
                            <th className="p-4 border-b border-slate-700 text-center">Rol</th>
                            <th className="p-4 border-b border-slate-700 text-center">Tickets</th>
                            <th className="p-4 border-b border-slate-700 text-right">Monto Vendido</th>
                            <th className="p-4 border-b border-slate-700 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {usersInfo.map((user, index) => (
                            <tr key={user.usuario_id} className="hover:bg-slate-700/20 transition-colors">
                                <td className="p-4 text-center">
                                    {index === 0 && user.numero_ventas > 0 ? <Award className="text-yellow-500 inline-block" size={24} /> :
                                     index === 1 && user.numero_ventas > 0 ? <Award className="text-slate-300 inline-block" size={24} /> :
                                     index === 2 && user.numero_ventas > 0 ? <Award className="text-amber-600 inline-block" size={24} /> :
                                     <span className="text-slate-500 font-bold">{index + 1}</span>}
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-white text-lg">{user.username}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold">ID: {user.usuario_id}</div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase ${
                                        user.rol === 'admin' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : 'bg-slate-900 text-slate-300 border-slate-700'
                                    }`}>
                                        {user.rol || 'OPERADOR'}
                                    </span>
                                </td>
                                <td className="p-4 text-center font-mono text-slate-300">{user.numero_ventas}</td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2 text-xl font-black text-green-500 font-mono">
                                        <TrendingUp size={16} />
                                        ${Number(user.total_vendido).toFixed(2)}
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setUsuarioAResetear(user)}
                                            className="text-slate-400 hover:text-yellow-500 transition-colors"
                                            title="Cambiar Contraseña"
                                        >
                                            <Key size={18} />
                                        </button>
                                        <button
                                            onClick={() => setConfirmarEliminar(user)}
                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                            title="Eliminar Usuario"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UsersPage;
