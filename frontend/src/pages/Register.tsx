import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Loader2, ArrowRight, UserPlus } from 'lucide-react';
import { FaceCapture478 } from '../components/FaceCapture478';
import { supabase } from '../services/supabase';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { registerUser } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [telefono, setTelefono] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enableFace, setEnableFace] = useState(false);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Por favor llena todos los campos obligatorios.');
      return;
    }
    if (nombre.trim().length < 2) { setErrorMsg('El nombre debe tener al menos 2 caracteres.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErrorMsg('Ingresa un correo electronico valido.'); return; }
    if (password.length < 6) { setErrorMsg('La contrasena debe tener al menos 6 caracteres.'); return; }

    setIsLoading(true);
    try {
      const result = await registerUser({
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        telefono: telefono.trim() || undefined,
        empresa: empresa.trim() || undefined,
      });
      if (result.success) {
        if (result.userId) setUserId(result.userId);
        if (enableFace && result.userId) {
          setSuccessMsg('Cuenta creada. Ahora registra tu rostro para continuar.');
          setShowFaceCapture(true);
        } else {
          setSuccessMsg('Cuenta creada correctamente. Revisa tu email para confirmar.');
          setTimeout(() => navigate('/login'), 2000);
        }
      } else {
        setErrorMsg(result.message || 'Error al crear la cuenta');
      }
    } catch { setErrorMsg('Error de conexion'); }
    setIsLoading(false);
  }, [nombre, email, password, telefono, empresa, enableFace, navigate]);

  const handleFaceRegistered = async (data: { signature: number[]; landmarks478: number[] }) => {
    setShowFaceCapture(false);
    setSuccessMsg('Cuenta y rostro registrados correctamente (478 puntos).');
    setTimeout(() => navigate('/login'), 2000);
  };

  const handleFaceClose = async () => {
    setShowFaceCapture(false);
    if (userId && enableFace) {
      setErrorMsg('Debes completar el registro facial para crear tu cuenta. Eliminando cuenta temporal...');
      try {
        await supabase.from('usuarios').delete().eq('id', userId);
      } catch { /* empty */ }
      setUserId(null);
      setSuccessMsg('');
    }
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3 : 2;
  const strengthColors = ['bg-slate-200', 'bg-red-400', 'bg-yellow-400', 'bg-green-400'];
  const strengthLabels = ['', 'Debil', 'Media', 'Fuerte'];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Crear Cuenta</h1>
          <p className="text-slate-500 text-sm mb-8">Registrate para comenzar</p>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
              <span className="text-red-500 text-sm">{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
              <span className="text-green-600 text-sm">{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo *</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo Electronico *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefono</label>
                <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9 digitos"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Empresa</label>
                <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Tu empresa"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Contrasena *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strengthColors[passwordStrength]}`} style={{ width: `${(passwordStrength + 1) * 25}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{strengthLabels[passwordStrength]}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 py-1">
              <input type="checkbox" id="enableFace" checked={enableFace} onChange={e => setEnableFace(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="enableFace" className="text-sm text-slate-600">Registrar rostro ahora (opcional)</label>
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>Crear Cuenta <UserPlus size={16} /></>}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">Inicia sesion</Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link to="/" className="hover:text-slate-600">&larr; Volver al inicio</Link>
        </p>
      </div>

      {showFaceCapture && userId && (
        <FaceCapture478 mode="register" usuarioId={userId} onCapture={handleFaceRegistered} onClose={handleFaceClose} />
      )}
    </div>
  );
};
