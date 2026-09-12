import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, MessageSquare, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function ComentariosPublico() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [contenido, setContenido] = useState('');
  const [canal, setCanal] = useState('web');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nombre.trim() || !email.trim() || !contenido.trim()) {
      setError('Todos los campos son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from('comentarios').insert({
        contenido: contenido.trim(),
        canal,
        estado: 'pendiente',
        categoria: 'SUGERENCIA',
      });
      if (insertError) throw insertError;
      setSuccess(true);
      setNombre(''); setEmail(''); setContenido('');
    } catch (err: any) {
      setError(err?.message || 'Error al enviar el comentario');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-indigo-900/10" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">BADI Corp</h1>
              <p className="text-[10px] text-blue-300 tracking-widest uppercase">Comentarios</p>
            </div>
          </div>
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Volver
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={28} className="text-blue-400" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Comentanos</h2>
              <p className="text-slate-400">Tu opinion nos ayuda a mejorar. Comparte tu experiencia.</p>
            </div>

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4 mb-6 flex items-center gap-3">
                <CheckCircle size={20} className="text-green-400" />
                <div>
                  <p className="text-green-300 font-medium">Comentario enviado</p>
                  <p className="text-green-400/70 text-sm">Gracias por tu feedback. Lo revisaremos pronto.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-4 mb-6">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nombre *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Correo electronico *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Canal de origen *</label>
                <select value={canal} onChange={e => setCanal(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                  <option value="web">Web</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="redes sociales">Redes Sociales</option>
                  <option value="presencial">Presencial</option>
                  <option value="telefono">Telefono</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Comentario *</label>
                <textarea value={contenido} onChange={e => setContenido(e.target.value)} placeholder="Escribe tu comentario aqui..." rows={5}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm resize-none" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <><Send size={16} /> Enviar comentario</>}
              </button>
            </form>
          </div>
        </main>

        <footer className="px-8 py-4 text-center text-xs text-slate-600">
          &copy; 2026 BADI Corp. Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
