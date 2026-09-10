import { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Search, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/services/supabase';

interface FAQItem { id: number; pregunta: string; respuesta: string; categoria: string; activo: boolean; }

export const FAQ = () => {
  const [faq, setFaq] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('faq').select('*').eq('activo', true).order('id');
      setFaq((data || []) as FAQItem[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtrados = faq.filter((f) => {
    const texto = `${f.pregunta} ${f.respuesta} ${f.categoria || ''}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  const categorias = [...new Set(filtrados.map((f) => f.categoria).filter(Boolean))];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
            <HelpCircle size={28} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Centro de Ayuda</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Encuentra respuestas a las preguntas mas frecuentes</p>
        </div>

        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en preguntas frecuentes..." className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm" />
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No se encontraron preguntas</p>
          </div>
        ) : (
          <div className="space-y-6">
            {categorias.length > 0 ? categorias.map((cat) => (
              <div key={cat}>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">{cat}</h3>
                <div className="space-y-2">
                  {filtrados.filter((f) => f.categoria === cat).map((f) => (
                    <div key={f.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button type="button" onClick={() => setOpenId(openId === f.id ? null : f.id)} className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <span className="text-sm font-medium text-slate-700 dark:text-white pr-4">{f.pregunta}</span>
                        {openId === f.id ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                      </button>
                      {openId === f.id && (
                        <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">{f.respuesta}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div className="space-y-2">
                {filtrados.map((f) => (
                  <div key={f.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <button type="button" onClick={() => setOpenId(openId === f.id ? null : f.id)} className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <span className="text-sm font-medium text-slate-700 dark:text-white pr-4">{f.pregunta}</span>
                      {openId === f.id ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                    </button>
                    {openId === f.id && (
                      <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">{f.respuesta}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-center text-white">
          <h3 className="font-semibold mb-2">No encontraste lo que buscabas?</h3>
          <p className="text-blue-100 text-sm mb-4">Crea una solicitud y nuestro equipo te ayudara personalizadamente.</p>
          <a href="/solicitudes" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition">
            Crear Solicitud
          </a>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
