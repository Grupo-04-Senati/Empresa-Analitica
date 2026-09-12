import { useState, useEffect } from 'react';
import { Hash, TrendingUp, BarChart3, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/services/supabase';

const PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#4f46e5', '#16a34a'];

const STOP_WORDS_ES = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'por', 'un', 'para', 'con', 'no', 'una',
  'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta',
  'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde',
  'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos',
  'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto',
  'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas',
  'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tu', 'tus', 'fue', 'fueron', 'es', 'son', 'ser', 'sido',
  'tengo', 'tiene', 'tienen', 'bien', 'mal', 'muy', 'hacer', 'he', 'ha', 'han'
]);

interface WordToken {
  palabra: string;
  conteo: number;
  porcentaje: number;
  color: string;
}

export const PalabrasFrecuentes = () => {
  const [tokens, setTokens] = useState<WordToken[]>([]);
  const [totalPalabras, setTotalPalabras] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchWords = async () => {
    setLoading(true);
    try {
      const freqMap: Record<string, number> = {};

      // 1. Try fetching from analisis_nlp table first
      const { data: nlpData } = await supabase.from('analisis_nlp').select('palabras_frecuentes, palabras_limpias');

      if (nlpData && nlpData.length > 0) {
        nlpData.forEach((row: Record<string, unknown>) => {
          const raw = row.palabras_frecuentes;
          let words: { palabra: string; frecuencia: number }[] = [];
          if (Array.isArray(raw)) {
            words = raw as { palabra: string; frecuencia: number }[];
          } else if (typeof raw === 'string') {
            try { words = JSON.parse(raw); } catch { /* ignore */ }
          }
          words.forEach((w) => {
            const wordStr = (w.palabra || String(w)).toLowerCase().trim();
            if (wordStr.length > 2 && !STOP_WORDS_ES.has(wordStr)) {
              freqMap[wordStr] = (freqMap[wordStr] || 0) + (w.frecuencia || 1);
            }
          });
        });
      }

      // 2. If nlpData yielded few words, fallback to tokenize comentarios text directly
      if (Object.keys(freqMap).length < 5) {
        const { data: commentsData } = await supabase.from('comentarios').select('contenido');
        if (commentsData) {
          commentsData.forEach((c: { contenido: string }) => {
            const rawTokens = c.contenido.toLowerCase().split(/[^\wáéíóúñÁÉÍÓÚÑ]+/);
            rawTokens.forEach((t) => {
              const clean = t.trim();
              if (clean.length > 2 && !STOP_WORDS_ES.has(clean) && isNaN(Number(clean))) {
                freqMap[clean] = (freqMap[clean] || 0) + 1;
              }
            });
          });
        }
      }

      const totalCount = Object.values(freqMap).reduce((a, b) => a + b, 0);
      setTotalPalabras(totalCount);

      const maxCount = Math.max(...Object.values(freqMap), 1);
      const sorted = Object.entries(freqMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([palabra, count], i) => ({
          palabra,
          conteo: count,
          porcentaje: totalCount > 0 ? Number(((count / totalCount) * 100).toFixed(1)) : 0,
          color: PALETTE[i % PALETTE.length],
        }));

      setTokens(sorted);
    } catch (err) {
      console.error('Error procesando palabras frecuentes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  const topWord = tokens[0];

  const kpis = [
    { label: 'Términos únicos', valor: tokens.length.toString(), icono: Hash, color: 'text-blue-600', bg: 'bg-blue-50' },
    {
      label: 'Palabras analizadas',
      valor: totalPalabras.toLocaleString(),
      icono: FileText,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Término más frecuente',
      valor: topWord ? `${topWord.palabra} (${topWord.conteo}x)` : '—',
      icono: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Palabras Frecuentes</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis cuantitativo de términos en los comentarios de clientes</p>
        </div>
        <button
          onClick={fetchWords}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icono;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
              <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${k.bg} ${k.color}`}>
                <Icon size={20} />
              </span>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{k.label}</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{k.valor}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Nube de palabras */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Nube de Términos Clave</h3>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">Frecuencia real</span>
          </div>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin palabras clave disponibles en comentarios
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 justify-center items-center py-6 min-h-[280px]">
              {tokens.map((w) => {
                const maxCount = tokens[0]?.conteo || 1;
                const weightRatio = w.conteo / maxCount;
                const fontSize = Math.max(12, Math.min(22, 12 + weightRatio * 10));
                return (
                  <span
                    key={w.palabra}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium border transition-all hover:scale-105 cursor-default"
                    style={{
                      fontSize: `${fontSize}px`,
                      color: w.color,
                      background: `${w.color}10`,
                      borderColor: `${w.color}30`,
                    }}
                    title={`${w.palabra}: ${w.conteo} apariciones (${w.porcentaje}% del total)`}
                  >
                    {w.palabra}
                    <span className="text-[11px] font-bold opacity-75 bg-white/60 px-1.5 py-0.5 rounded-full">
                      {w.conteo}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabla / Ranking de frecuencia */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Hash size={18} className="text-amber-600" />
              <h3 className="font-semibold text-slate-700">Ranking de Frecuencia</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Top 10 términos</span>
          </div>
          {loading ? (
            <div className="h-[280px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
              Sin datos disponibles
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 max-h-[280px] overflow-y-auto pr-1">
              {tokens.slice(0, 10).map((w, idx) => {
                const maxCount = tokens[0]?.conteo || 1;
                const barWidth = Math.max(5, Math.round((w.conteo / maxCount) * 100));
                return (
                  <div key={w.palabra} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700 flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-4">{idx + 1}.</span>
                        {w.palabra}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {w.conteo} veces <span className="text-slate-400 font-normal">({w.porcentaje}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, background: w.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PalabrasFrecuentes;
