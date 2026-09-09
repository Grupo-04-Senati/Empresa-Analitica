import { useState } from 'react';
import { UserPlus, ArrowLeft, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';

export const ClientesNuevo = () => {
  const navigate = useNavigate();
  const [guardado, setGuardado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nombre: '', empresa: '', email: '', telefono: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (!form.password || form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      setSaving(false);
      return;
    }

    try {
      const existingUser = await supabase.from('usuarios').select('id').eq('email', form.email.trim().toLowerCase()).maybeSingle();
      if (existingUser.data) {
        setError('Ya existe un usuario con este correo');
        setSaving(false);
        return;
      }

      const { error: authErr } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: { data: { nombre: form.nombre.trim(), rol: 'USUARIO' } },
      });
      if (authErr && !authErr.message.includes('already registered')) {
        setError('Error creando cuenta: ' + authErr.message);
        setSaving(false);
        return;
      }

      const { error: dbErr } = await supabase.from('usuarios').insert({
        nombre: form.nombre.trim(),
        email: form.email.trim().toLowerCase(),
        password_hash: 'auth_managed',
        rol: 'USUARIO',
        activo: true,
        telefono: form.telefono || null,
        empresa: form.empresa || null,
      });
      if (dbErr) throw dbErr;

      try { await supabase.auth.signOut(); } catch {}
      setGuardado(true);
      setTimeout(() => navigate('/clientes'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Nuevo Cliente</h2>
            <p className="mt-1 text-sm text-slate-500">Registrar un nuevo cliente en la plataforma</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors" onClick={() => navigate('/clientes')}>
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>

        {guardado && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-600 text-sm font-medium">
            <CheckCircle2 size={16} />
            Cliente registrado correctamente
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-500 text-sm">{error}</div>
        )}

        <div className="rounded-xl bg-white border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Datos del Cliente</h3>
          </div>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</label>
                <input required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Ana Torres" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                <input value={form.empresa} onChange={(e) => set('empresa', e.target.value)} placeholder="Ej: Empresa ABC S.A." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Correo electronico</label>
                <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="correo@empresa.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefono</label>
                <input value={form.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^0-9]/g, '').slice(0, 9))} placeholder="999888777" maxLength={9} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contrasena</label>
              <div className="relative">
                <input required type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Minimo 6 caracteres" minLength={6} className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">El cliente usara este correo y contrasena para iniciar sesion</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => navigate('/clientes')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Registrar Cliente
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClientesNuevo;
