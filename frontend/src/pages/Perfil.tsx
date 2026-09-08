import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '@/services/supabase';
import { logAudit } from '../services/audit';
import { User, Shield, Bell, LogOut, Edit3, Save, X, CheckCircle, ArrowLeft, Eye, EyeOff, Camera, AlertTriangle, Trash2, Scan } from 'lucide-react';
import { FaceCapture } from '../components/FaceCapture';
import { hasFaceRegistered } from '../services/faceRecognition';

export const Perfil: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [alerta, setAlerta] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setNombre(user.nombre || '');
      fetchAvatar();
    }
  }, [user]);

  const fetchAvatar = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('usuarios').select('avatar_url').eq('email', user.email).maybeSingle();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    } catch { /* empty */ }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setAlerta('Solo se permiten archivos de imagen');
      setTimeout(() => setAlerta(''), 3500);
      return;
    }
    setUploading(true);
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 200;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX) { h = (h * MAX) / w; w = MAX; } }
          else { if (h > MAX) { w = (w * MAX) / h; h = MAX; } }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => reject(new Error('Error cargando imagen'));
        img.src = URL.createObjectURL(file);
      });

      const { error } = await supabase.from('usuarios').update({ avatar_url: compressed }).eq('email', user.email);
      if (error) {
        console.error('[avatar] DB error:', error);
        setAlerta('Error guardando en base de datos');
        setUploading(false);
        setTimeout(() => setAlerta(''), 3500);
        return;
      }

      await supabase.auth.updateUser({ data: { avatar_url: compressed } });
      logAudit({ usuario_id: Number(user?.id) || undefined, usuario_email: user?.email, accion: 'UPDATE', tabla: 'usuarios', registro_id: Number(user?.id) || undefined, modulo: 'Perfil', detalles: 'Foto de perfil actualizada' });
      setAvatarUrl(compressed);
      setUploading(false);
      setAlerta('Foto de perfil actualizada');
      setTimeout(() => setAlerta(''), 3500);
    } catch (err) {
      console.error('[avatar] Error:', err);
      setUploading(false);
      setAlerta('Error al subir la imagen');
      setTimeout(() => setAlerta(''), 3500);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setAlerta('El nombre no puede estar vacio'); setTimeout(() => setAlerta(''), 3500); return; }
    if (nombre.trim().length < 2) { setAlerta('El nombre debe tener al menos 2 caracteres'); setTimeout(() => setAlerta(''), 3500); return; }
    const nombreAnterior = user?.nombre || '';
    await updateUser({ nombre: nombre.trim() });
    const { data: authData } = await supabase.auth.getUser();
    const currentMeta = authData?.user?.user_metadata || {};
    await supabase.auth.updateUser({ data: { ...currentMeta, nombre: nombre.trim() } });
    logAudit({ usuario_id: Number(user?.id) || undefined, usuario_email: user?.email, accion: 'UPDATE', tabla: 'usuarios', registro_id: Number(user?.id) || undefined, modulo: 'Perfil', detalles: `Nombre cambiado de "${nombreAnterior}" a "${nombre.trim()}"`, datos_anteriores: { nombre: nombreAnterior }, datos_nuevos: { nombre: nombre.trim() } });
    setIsModalOpen(false);
    setAlerta('Informacion actualizada correctamente');
    setTimeout(() => setAlerta(''), 3500);
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const getInitials = () => {
    if (user?.nombre) return user.nombre.charAt(0).toUpperCase();
    return user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  };

  const [showPassModal, setShowPassModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [notifSettings, setNotifSettings] = useState({ email: true, web: true, pendientes: true });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);

  useEffect(() => {
    const fetchFace = async () => {
      if (!user) return;
      try {
        const hasFace = await hasFaceRegistered(Number(user.id));
        setFaceRegistered(hasFace);
      } catch { /* empty */ }
    };
    fetchFace();
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) { setPassMsg('La contrasena debe tener al menos 6 caracteres'); return; }
    if (newPass.length > 128) { setPassMsg('La contrasena no puede exceder 128 caracteres'); return; }
    if (newPass !== confirmPass) { setPassMsg('Las contrasenas no coinciden'); return; }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) { setPassMsg('Error: ' + error.message); return; }
      logAudit({ usuario_id: Number(user?.id) || undefined, usuario_email: user?.email, accion: 'UPDATE', tabla: 'usuarios', registro_id: Number(user?.id) || undefined, modulo: 'Perfil', detalles: 'Contrasena cambiada' });
      setPassMsg('Contrasena actualizada correctamente');
      setTimeout(() => { setPassMsg(''); setShowPassModal(false); setNewPass(''); setConfirmPass(''); }, 2000);
    } catch { setPassMsg('Error al actualizar contrasena'); }
  };

  const handleToggleNotif = (key: keyof typeof notifSettings) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) { setDeleteMsg('Ingresa tu contrasena'); return; }
    if (!deleteConfirm) { setDeleteMsg('Debes confirmar que entiendes la accion'); return; }
    setDeleteLoading(true);
    setDeleteMsg('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: deletePassword,
      });
      if (signInError) {
        setDeleteMsg('Contrasena incorrecta');
        setDeleteLoading(false);
        return;
      }

      const uid = Number(user!.id);

      const { data: rostros } = await supabase.from('rostros').select('id').eq('usuario_id', uid);
      if (rostros && rostros.length > 0) {
        await supabase.from('rostros').delete().eq('usuario_id', uid);
      }

      const { data: auditoria } = await supabase.from('auditoria').select('id').eq('usuario_id', uid);
      if (auditoria && auditoria.length > 0) {
        await supabase.from('auditoria').delete().eq('usuario_id', uid);
      }

      const { data: optimizaciones } = await supabase.from('optimizaciones').select('id').eq('usuario_id', uid);
      if (optimizaciones && optimizaciones.length > 0) {
        await supabase.from('optimizaciones').delete().eq('usuario_id', uid);
      }

      await supabase.from('usuarios').delete().eq('id', uid);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      if (supabaseUrl && serviceKey) {
        try {
          const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          });
          const listData = await listRes.json();
          console.log('[delete] Auth list status:', listRes.status, listData);
          if (listRes.ok) {
            const authUser = listData.users?.find((u: any) => u.email === user!.email);
            if (authUser) {
              const delRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
                method: 'DELETE',
                headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
              });
              console.log('[delete] Auth delete status:', delRes.status, await delRes.text());
            } else {
              console.log('[delete] Auth user not found for:', user!.email);
            }
          }
        } catch (e) { console.error('[delete] Auth deletion error:', e); }
      } else {
        console.log('[delete] Missing supabaseUrl or serviceKey');
      }

      await logout();
      navigate('/login');
    } catch {
      setDeleteMsg('Error al eliminar la cuenta');
    } finally {
      setDeleteLoading(false);
    }
  };

  const sections = [
    { icon: User, title: 'Informacion Personal', desc: 'Consulta tu nombre y datos de contacto registrados.', onClick: () => setIsViewModalOpen(true) },
    { icon: Shield, title: 'Seguridad & Contrasena', desc: 'Cambia tu clave de acceso de forma segura.', onClick: () => setShowPassModal(true) },
    { icon: Scan, title: 'Reconocimiento Facial', desc: faceRegistered ? 'Tu rostro esta registrado. Puedes reemplazarlo.' : 'Configura el inicio de sesion con tu rostro.', onClick: () => setShowFaceCapture(true) },
    { icon: Shield, title: 'Roles & Permisos', desc: `Tu rol actual: ${user?.rol || 'usuario'}. Solo los administradores pueden gestionar roles.`, onClick: () => {} },
    { icon: Bell, title: 'Notificaciones', desc: 'Configura alertas para solicitudes pendientes y reportes.', onClick: () => {} },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors backdrop-blur-sm">
            <ArrowLeft size={16} /> Volver al Dashboard
          </button>
          <span className="text-sm font-semibold text-slate-400">Ajustes de Cuenta</span>
        </div>

        {alerta && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${alerta.includes('Error') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
            <CheckCircle size={16} /> {alerta}
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/80 rounded-2xl border border-slate-700 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md shadow-xl shadow-black/30">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-2xl border-2 border-sky-400 overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : getInitials()}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={uploading}
              >
                <Camera size={20} className="text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-50">{user?.nombre}</h2>
                <button type="button" onClick={() => setIsModalOpen(true)} className="p-1.5 rounded-full bg-sky-400/10 border border-sky-400/20 hover:bg-sky-400/20 transition-colors" title="Editar Perfil">
                  <Edit3 size={14} className="text-sky-400" />
                </button>
              </div>
              <p className="text-sm text-slate-400 mt-1">{user?.email}</p>
              <span className="inline-block mt-1.5 text-[11px] font-semibold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20">
                Rol: {user?.rol || 'usuario'} · NEXUS Corp
              </span>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
            <LogOut size={14} /> Cerrar Sesion
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.title} type="button" onClick={s.onClick} className="bg-gradient-to-br from-slate-800/50 to-slate-900/60 rounded-2xl border border-slate-700/80 p-5 text-left hover:border-slate-600 transition-all backdrop-blur-md cursor-pointer group">
                <div className="flex gap-3 items-start">
                  <div className="bg-sky-400/10 p-2 rounded-lg border border-sky-400/15 group-hover:bg-sky-400/20 transition-colors">
                    <Icon size={20} className="text-sky-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-50">{s.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {isViewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-slate-50">Detalles de Informacion Personal</h3>
                <button type="button" onClick={() => setIsViewModalOpen(false)} className="text-slate-400 hover:text-slate-200 transition-colors p-1"><X size={18} /></button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre</label>
                  <div className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-50 font-medium">{user?.nombre || 'No especificado'}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Correo Electronico</label>
                  <div className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-50 font-medium">{user?.email || 'No especificado'}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Rol Asignado</label>
                  <div className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-50 font-medium">{user?.rol || 'usuario'}</div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => setIsViewModalOpen(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"><Save size={14} /> Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-slate-50">Editar Informacion Personal</h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200 transition-colors p-1"><X size={18} /></button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-3xl border-2 border-sky-400 overflow-hidden">
                      {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : getInitials()}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={uploading}
                    >
                      <Camera size={18} className="text-white" />
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">{uploading ? 'Subiendo...' : 'Click para cambiar foto'}</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre</label>
                  <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''))} maxLength={100} className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-sky-400 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all" required />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">Cancelar</button>
                  <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"><Save size={14} /> Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-slate-50">Cambiar Contrasena</h3>
                <button type="button" onClick={() => { setShowPassModal(false); setPassMsg(''); }} className="text-slate-400 hover:text-slate-200 transition-colors p-1"><X size={18} /></button>
              </div>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nueva contrasena</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all pr-10" placeholder="Minimo 6 caracteres" maxLength={128} required />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Confirmar contrasena</label>
                  <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400/50 transition-all" placeholder="Repite la contrasena" maxLength={128} required />
                </div>
                {passMsg && <p className={`text-xs font-medium ${passMsg.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>{passMsg}</p>}
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => { setShowPassModal(false); setPassMsg(''); }} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">Cancelar</button>
                  <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"><Save size={14} /> Actualizar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    <AlertTriangle size={20} className="text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-red-300">Eliminar Cuenta</h3>
                </div>
                <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteMsg(''); setDeletePassword(''); setDeleteConfirm(false); }} className="text-slate-400 hover:text-slate-200 transition-colors p-1"><X size={18} /></button>
              </div>
              <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  Estas a punto de eliminar tu cuenta <span className="font-semibold text-slate-100">{user?.email}</span>. Esta accion no se puede deshacer.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Ingresa tu contrasena para confirmar</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all"
                    placeholder="Tu contrasena actual"
                    maxLength={128}
                    required
                  />
                </div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-900 text-red-500 focus:ring-red-400/50"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed">
                    Entiendo que esta accion es irreversible y se eliminaran todos mis datos permanentemente
                  </span>
                </label>
                {deleteMsg && <p className="text-xs font-medium text-red-400">{deleteMsg}</p>}
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteModal(false); setDeleteMsg(''); setDeletePassword(''); setDeleteConfirm(false); }}
                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!deleteConfirm || !deletePassword || deleteLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleteLoading ? (
                      <><span className="animate-spin">⏳</span> Eliminando...</>
                    ) : (
                      <><Trash2 size={14} /> Eliminar Cuenta</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/60 rounded-2xl border border-slate-700/80 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-sky-400" />
            <h4 className="text-sm font-semibold text-slate-50">Configuracion de Notificaciones</h4>
          </div>
          <div className="flex flex-col gap-3">
            {[{ key: 'email' as const, label: 'Notificaciones por correo' }, { key: 'web' as const, label: 'Notificaciones en la plataforma' }, { key: 'pendientes' as const, label: 'Alertas de comentarios pendientes' }].map((n) => (
              <label key={n.key} className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">{n.label}</span>
                <div onClick={() => handleToggleNotif(n.key)} className={`relative w-10 h-5 rounded-full transition-colors ${notifSettings[n.key] ? 'bg-sky-500' : 'bg-slate-600'}`}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ left: notifSettings[n.key] ? '22px' : '2px' }} />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-950/30 to-slate-900/60 rounded-2xl border border-red-500/20 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-300">Zona de Peligro</h4>
              <p className="text-xs text-slate-400">Elimina tu cuenta permanentemente</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Al eliminar tu cuenta se borraran todos tus datos, incluyendo tu perfil, historial, configuracion de reconocimiento facial y cualquier otra informacion asociada. Esta accion es irreversible.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 hover:border-red-500/50 transition-all"
          >
            <Trash2 size={14} /> Eliminar mi cuenta
          </button>
        </div>
      </div>

      {showFaceCapture && user && (
        <FaceCapture
          mode="register"
          usuarioId={Number(user.id)}
          onCapture={async (photos) => {
            try {
              const res = await fetch('/face/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: Number(user.id), frontal: photos.frontal, izquierda: photos.izquierda, derecha: photos.derecha }),
              });
              const data = await res.json();
              if (res.ok) {
                setFaceRegistered(true);
                setAlerta('Rostro registrado correctamente');
                setTimeout(() => setAlerta(''), 3500);
              } else {
                setAlerta('Error: ' + (data.detail || 'No se pudo registrar'));
                setTimeout(() => setAlerta(''), 3500);
              }
            } catch {
              setAlerta('Error de conexion');
              setTimeout(() => setAlerta(''), 3500);
            }
            setShowFaceCapture(false);
          }}
          onClose={() => setShowFaceCapture(false)}
        />
      )}
    </div>
  );
};

export default Perfil;
