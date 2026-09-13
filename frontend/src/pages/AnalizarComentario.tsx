import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BrainCircuit, Send, Sparkles, Hash, Loader2, ThumbsUp, ThumbsDown, Zap, Tags,
} from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '../context/AuthContext';
import { analizar } from '../services/nlpApi';

interface AnalisisReciente {
  id: number;
  contenido: string;
  canal: string;
  fecha: string;
  analisis_nlp: {
    idioma: string;
    categoria_detectada: string;
    confianza: number;
    palabras_frecuentes: string[];
    sentimiento?: string;
  } | null;
}

const STORAGE_KEY = 'badi_custom_words';

const DEFAULT_POSITIVAS = ['excelente','bueno','buen','buenas','genial','increible','perfecto','agradecido','agradecida','gracias','feliz','satisfecho','satisfecha','recomiendo','me gusta','maravilloso','fantastico','rapido','rapida','eficiente','calidad','profesional','amable','resolvio','ayuda','mejor','bien','ok','servicio bueno','todo bien','funciona bien'];
const DEFAULT_NEGATIVAS = ['malo','mala','terrible','pesimo','horrible','lento','lenta','error','problema','queja','reclamo','insatisfecho','decepcionado','no funciona','no sirve','muy lento','deficiente','lamentable','estafa','fraude','furioso','furiosa','molesto','molesta','incumplimiento','carajo','mierda','puta','maldito','maldita','culo','pendejo','pendeja','estupido','estupida','imbécil','imbecil','idiota','basura','asco','asqueroso','desastre','falso','robo','robado','corrupto','corrupta','inutil','verguenza','odio','odioso','detesto','desesperado','desesperada','hartado','hartada','harto','harta','jodido','jodida','hijueputa','malparido','careverga','marica','maricon','puto','pedo','caca','verga','torpe'];
const DEFAULT_NEUTRAS = ['informacion','consulta','datos','estado','proceso','tiempo','fecha','numero','detalle','general'];

function loadCustomWords(): Record<string, string[]> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        positivas: [...new Set([...DEFAULT_POSITIVAS, ...(parsed.positivas || [])])],
        negativas: [...new Set([...DEFAULT_NEGATIVAS, ...(parsed.negativas || [])])],
        neutras: [...new Set([...DEFAULT_NEUTRAS, ...(parsed.neutras || [])])],
      };
    }
  } catch { /* empty */ }
  return { positivas: DEFAULT_POSITIVAS, negativas: DEFAULT_NEGATIVAS, neutras: DEFAULT_NEUTRAS };
}

function saveCustomWords(words: Record<string, string[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(words)); } catch { /* empty */ }
}

const PalabrasEditor = () => {
  const [words, setWords] = useState<Record<string, string[]>>(loadCustomWords);
  const [newWord, setNewWord] = useState('');
  const [wordType, setWordType] = useState('positivas');

  useEffect(() => { saveCustomWords(words); }, [words]);

  const addWord = () => {
    if (!newWord.trim()) return;
    setWords(prev => ({
      ...prev,
      [wordType]: [...new Set([...(prev[wordType] || []), newWord.trim().toLowerCase()])],
    }));
    setNewWord('');
  };

  const removeWord = (type: string, word: string) => {
    setWords(prev => ({
      ...prev,
      [type]: (prev[type] || []).filter(w => w !== word),
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={wordType} onChange={e => setWordType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="positivas">Positivas</option>
          <option value="negativas">Negativas</option>
          <option value="neutras">Neutras</option>
        </select>
        <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()}
          placeholder="Nueva palabra..." className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        <button onClick={addWord} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">Agregar</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(words).map(([key, wordList]) => {
          const color = key === 'positivas' ? 'emerald' : key === 'negativas' ? 'red' : 'slate';
          return (
            <div key={key} className="rounded-lg p-3" style={{ backgroundColor: color === 'emerald' ? '#ecfdf5' : color === 'red' ? '#fef2f2' : '#f8fafc' }}>
              <p className="text-xs font-medium uppercase mb-2" style={{ color: color === 'emerald' ? '#065f46' : color === 'red' ? '#991b1b' : '#475569' }}>{key} ({wordList.length})</p>
              <div className="flex flex-wrap gap-1">
                {wordList.map(w => (
                  <span key={w} className="px-2 py-0.5 text-[10px] rounded-full flex items-center gap-1" style={{ backgroundColor: color === 'emerald' ? '#d1fae5' : color === 'red' ? '#fee2e2' : '#e2e8f0', color: color === 'emerald' ? '#065f46' : color === 'red' ? '#991b1b' : '#475569' }}>
                    {w}
                    <button onClick={() => removeWord(key, w)} className="opacity-50 hover:opacity-100">x</button>
                  </span>
                ))}
                {wordList.length === 0 && <span className="text-[10px] text-slate-400">Vacio</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ResultadoLocal {
  tokens: string[];
  palabrasFrecuentes: { palabra: string; frecuencia: number }[];
  categoria: string;
  confianza: number;
  sentimiento: 'positivo' | 'negativo' | 'neutro';
  temas: string[];
}

export const AnalizarComentario = () => {
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState('web');
  const [resultado, setResultado] = useState<ResultadoLocal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [recientes, setRecientes] = useState<AnalisisReciente[]>([]);

  useEffect(() => {
    const comentarioParam = searchParams.get('comentario');
    if (comentarioParam) setTexto(comentarioParam);
  }, [searchParams]);

  useEffect(() => { cargarRecientes(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('comentarios-recientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, () => {
        cargarRecientes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const analizarTexto = async () => {
    if (!texto.trim()) return;
    setCargando(true);
    const result = await analizar(texto);
    setResultado({
      tokens: result.tokens,
      palabrasFrecuentes: result.palabras_frecuentes,
      categoria: result.categoria_detectada,
      confianza: result.confianza,
      sentimiento: result.sentimiento,
      temas: result.temas,
    });
    setCargando(false);
  };

  const handleAnalizarComentario = async (comentario: AnalisisReciente) => {
    setTexto(comentario.contenido);
    setCanal(comentario.canal);
    setCargando(true);
    const result = await analizar(comentario.contenido);
    setResultado({
      tokens: result.tokens,
      palabrasFrecuentes: result.palabras_frecuentes,
      categoria: result.categoria_detectada,
      confianza: result.confianza,
      sentimiento: result.sentimiento,
      temas: result.temas,
    });
    setCargando(false);
  };

  const cargarRecientes = async () => {
    const { data } = await supabase
      .from('comentarios')
      .select('id, contenido, canal, fecha, analisis_nlp(idioma, categoria_detectada, confianza, palabras_frecuentes, sentimiento)')
      .eq('tipo', 'comentario')
      .order('fecha', { ascending: false })
      .limit(20);
    if (data) setRecientes(data as unknown as AnalisisReciente[]);
  };

  const guardarEnBD = async () => {
    if (!resultado || !texto.trim()) return;
    setGuardando(true);
    try {
      const { data: comentario, error: err1 } = await supabase.from('comentarios').insert({
        contenido: texto,
        canal,
        tipo: 'comentario',
        estado: 'procesado',
        procesado: true,
        categoria: resultado.categoria,
        fecha: new Date().toISOString(),
      }).select('id').single();
      if (err1) throw err1;
      if (comentario) {
        const { error: err2 } = await supabase.from('analisis_nlp').insert({
          comentario_id: comentario.id,
          idioma: 'es',
          cantidad_palabras: resultado.tokens.length,
          palabras_limpias: resultado.tokens,
          palabras_frecuentes: resultado.palabrasFrecuentes.map(p => p.palabra),
          categoria_detectada: resultado.categoria,
          confianza: resultado.confianza / 100,
          sentimiento: resultado.sentimiento,
          fecha_analisis: new Date().toISOString(),
        });
        if (err2) console.error('Error saving analisis_nlp:', err2);
      }
      setTexto('');
      setResultado(null);
      await cargarRecientes();
    } catch (err) {
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analizar Comentario</h2>
          <p className="text-slate-500 text-sm mt-1">
            {isAdmin
              ? 'Haz clic en un comentario reciente para analizarlo automaticamente'
              : 'Analisis de sentimiento y clasificacion automatica'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            <Zap size={14} />
            ML Backend
          </span>
          <span className="inline-flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Analisis activo
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Texto a Analizar</h3>
          </div>

          {isAdmin ? (
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Canal de origen (definido por el usuario)</label>
              <div className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 capitalize">
                {canal}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-semibold text-slate-700">Canal de origen:</label>
              <select value={canal} onChange={e => setCanal(e.target.value)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="web">Web</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="redes sociales">Redes Sociales</option>
                <option value="presencial">Presencial</option>
                <option value="telefono">Telefono</option>
              </select>
            </div>
          )}

          <textarea
            className="w-full h-40 p-4 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Pega aqui el comentario del cliente para analizarlo..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end mt-4">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              onClick={analizarTexto}
              disabled={cargando || !texto.trim()}
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Analizar
            </button>
          </div>
        </div>

        {resultado ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                <h3 className="font-semibold text-slate-700">Resultado del Analisis</h3>
              </div>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
                onClick={guardarEnBD}
                disabled={guardando}
              >
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Guardar en BD
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Tokens procesados</p>
                <p className="text-lg font-bold text-slate-800">{resultado.tokens.length}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Categoria detectada</p>
                <p className="text-lg font-bold text-slate-800">{resultado.categoria}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Confianza</p>
                <p className="text-lg font-bold text-slate-800">{resultado.confianza.toFixed(1)}%</p>
                <div className="w-full h-2 bg-slate-200 rounded-full mt-2">
                  <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, resultado.confianza)}%` }} />
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Sentimiento</p>
                <div className="flex items-center gap-2 mt-1">
                  {resultado.sentimiento === 'positivo' ? (
                    <>
                      <ThumbsUp size={20} className="text-emerald-500" />
                      <span className="text-lg font-bold text-emerald-600">Positivo</span>
                    </>
                  ) : resultado.sentimiento === 'negativo' ? (
                    <>
                      <ThumbsDown size={20} className="text-red-500" />
                      <span className="text-lg font-bold text-red-600">Negativo</span>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-slate-500">Neutro</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                <Hash size={13} /> Palabras mas frecuentes
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.palabrasFrecuentes.length > 0 ? resultado.palabrasFrecuentes.map((w) => (
                  <span key={w.palabra} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                    {w.palabra} ({w.frecuencia})
                  </span>
                )) : (
                  <span className="text-xs text-slate-400">Sin palabras clave encontradas</span>
                )}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                <Sparkles size={13} /> Temas detectados
              </p>
              <div className="flex flex-wrap gap-2">
                {resultado.temas.map((t) => (
                  <span key={t} className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <BrainCircuit size={34} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">Esperando analisis</p>
            <p className="text-sm text-slate-400 max-w-xs">
              {isAdmin
                ? 'Haz clic en un comentario de la tabla de abajo para analizarlo automaticamente.'
                : 'Ingresa un comentario y presiona "Analizar" para ver el resultado.'}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
        <details>
          <summary className="flex items-center gap-2 cursor-pointer select-none">
            <Tags size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700 flex-1">Palabras de Analisis (Admin)</h3>
            <span className="text-xs text-slate-400">Personalizar</span>
          </summary>
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-500">Agrega palabras personalizadas para mejorar la deteccion de sentimiento.</p>
            <PalabrasEditor />
          </div>
        </details>
      </div>

      <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Analisis Recientes</h3>
          {isAdmin && (
            <span className="text-xs text-slate-400 ml-2">— haz clic en un comentario para analizarlo</span>
          )}
        </div>
        {recientes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No hay analisis recientes en la base de datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Fecha</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Canal</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Comentario</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Categoria</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Confianza</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Sentimiento</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-50 transition ${
                      isAdmin ? 'hover:bg-blue-50/50 cursor-pointer' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => isAdmin && handleAnalizarComentario(r)}
                  >
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(r.fecha).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full capitalize">{r.canal}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{r.contenido}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                        {r.analisis_nlp?.categoria_detectada ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {r.analisis_nlp?.confianza != null ? `${(r.analisis_nlp.confianza * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {r.analisis_nlp?.sentimiento === 'positivo' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium">
                          <ThumbsUp size={12} /> Positivo
                        </span>
                      ) : r.analisis_nlp?.sentimiento === 'negativo' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs rounded-full font-medium">
                          <ThumbsDown size={12} /> Negativo
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">Neutro</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
