import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function LoginPage() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/sucursales')
      .then(res => setSucursales(res.data))
      .catch(() => setMsg("No se pudieron cargar las sucursales"));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedSucursal) return setMsg("Por favor selecciona una sucursal.");
    setMsg('Validando credenciales...');
    try {
      const res = await api.post('/auth/login', { username: user, password: pass });
      const { token, usuario_id, sucursal_id: sucursalServidor, nombre, rol } = res.data;
      // Para admin se respeta la sucursal elegida en el login; para vendedores, la asignada en la DB
      const sucursal_id = rol === 'admin' ? selectedSucursal : sucursalServidor;

      localStorage.setItem('user', JSON.stringify({
        usuario_id,
        sucursal_id,
        nombre,
        rol,
        token,
      }));

      const nombreSucursal = sucursales.find(s => s.sucursal_id == selectedSucursal)?.nombre || '';
      setMsg(`¡Acceso concedido a ${nombreSucursal}!`);
      setTimeout(() => navigate('/ventas'), 800);
    } catch {
      setMsg('Error: Operador o Clave incorrectos');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border-b-8 border-yellow-500">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-tighter italic">ARCOIRIS</h1>
          <p className="text-yellow-500 font-bold text-xs tracking-widest uppercase">Industrial POS System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">ID Operador</label>
            <input
              type="text"
              placeholder="usuario"
              className="w-full bg-slate-900 border-2 border-slate-700 text-white p-3 rounded-lg focus:border-yellow-500 outline-none transition-all font-mono"
              onChange={(e) => setUser(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Clave de Acceso</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-slate-900 border-2 border-slate-700 text-white p-3 rounded-lg focus:border-yellow-500 outline-none transition-all font-mono"
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Sucursal de Trabajo</label>
            <select
              className="w-full bg-slate-900 border-2 border-slate-700 text-white p-3 rounded-lg focus:border-yellow-500 outline-none transition-all font-bold text-sm"
              value={selectedSucursal}
              onChange={(e) => setSelectedSucursal(e.target.value)}
              required
            >
              <option value="">-- SELECCIONAR SUCURSAL --</option>
              {sucursales.map(s => (
                <option key={s.sucursal_id} value={s.sucursal_id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <button className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-4 rounded-lg transition-all active:scale-95 shadow-lg shadow-yellow-500/10 uppercase tracking-tighter">
            Abrir Punto de Venta
          </button>
        </form>

        {msg && (
          <div className={`mt-6 p-3 rounded text-center text-xs font-black uppercase tracking-tighter border ${
            msg.includes('concedido')
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
