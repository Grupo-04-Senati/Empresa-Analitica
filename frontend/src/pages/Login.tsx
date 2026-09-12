import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, Scan, ArrowRight } from 'lucide-react';
import { FaceCapture478 } from '../components/FaceCapture478';
import { warmUpFaceEngine } from '../services/mediaPipeFace';

export default function Login() {
  const navigate = useNavigate();
  const { loginUser, loginByUserId } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFace, setShowFace] = useState(false);

  // Empieza a descargar el motor facial (~15 MB) en cuanto se abre la pantalla,
  // para que el escaner no arranque con la descarga cuando el usuario lo pulsa.
  useEffect(() => { warmUpFaceEngine(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Completa todos los campos'); return; }
    setLoading(true);
    try {
      const result = await loginUser(email, password);
      if (result.success) { navigate('/dashboard'); }
      else { setError(result.message || 'Credenciales incorrectas'); }
    } catch { setError('Error de conexion'); }
    setLoading(false);
  };

  const handleFaceLogin = async (userId: number, nombre: string) => {
    setShowFace(false);
    setLoading(true);
    try {
      const result = await loginByUserId(userId);
      if (result.success) navigate('/dashboard');
      else setError(result.message || 'Error al iniciar sesion');
    } catch { setError('Error de conexion'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Bienvenido de Nuevo</h1>
          <p className="text-slate-500 text-sm mb-8">Inicia sesion para continuar</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <span className="text-red-500 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo Electronico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contrasena</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm pr-12"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Iniciar Sesion <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-slate-400">o</span></div>
          </div>

          <button
            onClick={() => setShowFace(true)}
            className="w-full py-3 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Scan size={18} className="text-blue-500" />
            Iniciar sesion con mi rostro
          </button>

          <p className="text-center text-sm text-slate-500 mt-6">
            No tienes una cuenta?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">Registrate aqui</Link>
          </p>
          <p className="text-center text-xs text-slate-400 mt-2">
            Despues de registrarte, confirma tu email desde la bandeja de entrada.
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link to="/" className="hover:text-slate-600">&larr; Volver al inicio</Link>
        </p>
      </div>

      {showFace && <FaceCapture478 mode="login" onLoginMatch={handleFaceLogin} onClose={() => setShowFace(false)} />}
    </div>
  );
}
