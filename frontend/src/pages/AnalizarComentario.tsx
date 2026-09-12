import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BrainCircuit, Send, Sparkles, Tag, Hash, Loader2, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { supabase } from '@/services/supabase';

interface CategoriaDB {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

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

interface ResultadoLocal {
  tokens: string[];
  palabrasFrecuentes: { palabra: string; frecuencia: number }[];
  categoria: string;
  confianza: number;
  sentimiento: 'positivo' | 'negativo' | 'neutro';
}

const STOPWORDS_ES = new Set(['de','la','el','en','y','a','los','del','las','un','por','con','una','su','para','es','al','lo','como','más','o','pero','sus','le','ya','este','ha','sí','porque','esta','son','entre','cuando','muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí','antes','algunos','qué','unos','yo','otro','otras','otra','él','tanto','esa','estos','mucho','quienes','nada','muchos','cual','poco','ella','estar','estas','algunas','algo','nosotros','mi','mis','tú','te','ti','tu','tus','ellas','nosotras','vosotros','vosotras','os','mío','mía','míos','mías','tuyo','tuya','tuyos','tuyas','suyo','suya','suyos','suyas','nuestro','nuestra','nuestros','nuestras','vuestro','vuestra','vuestros','vuestras','esos','esas','estoy','estás','está','estamos','estáis','están','seré','serás','será','seremos','seréis','serán','sido','siendo','fue','fuera','han','hemos']);

const DEFAULT_POSITIVAS = ['excelente','bueno','buen','buenas','genial','increíble','increible','perfecto','agradecido','agradecida','gracias','feliz','satisfecho','satisfecha','recomiendo','me gusta','maravilloso','fantástico','fantastico','rápido','rapido','eficiente','calidad','profesional','amable','resolvio','ayuda','mejor','bien','ok','servicio bueno','todo bien','funciona bien'];
const DEFAULT_NEGATIVAS = ['malo','mala','terrible','pésimo','pesimo','horrible','lento','lenta','error','problema','queja','reclamo','insatisfecho','decepcionado','decepcionada','no funciona','no sirve','muy lento','deficiente','lamentable','estafa','fraude','furioso','furiosa','molesto','molesta','incumplimiento','carajo','mierda','puta','maldito','maldita','culo','pendejo','pendeja','estupido','estupida','imbécil','imbecil','idiota','basura','asco','asqueroso','asquerosa','desastre','falso','robo','robado','corrupto','corrupta','inutil','inútil','vergüenza','verguenza','odio','odioso','detesto','furibundo','desesperado','desesperada','hartado','hartada','harto','harta','jodido','jodida','hijueputa','malparido','careverga','marica','maricon','puto','prostituto','pedo','caca','verga','torpe'];

const STORAGE_KEY = 'badi_custom_words';

function loadCustomWords(): Record<string, string[]> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* empty */ }
  return { positivas: [], negativas: [], neutras: [] };
}

function saveCustomWords(words: Record<string, string[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(words)); } catch { /* empty */ }
}

function analizarConCategorias(texto: string, categorias: CategoriaDB[], customWords: Record<string, string[]>): ResultadoLocal {
  const limpio = texto.toLowerCase().replace(/[^\w\sáéíóúñ]/g, ' ');
  const tokens = limpio.split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS_ES.has(t));
  const freq: Record<string, number> = {};
  tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
  const palabrasFrecuentes = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([palabra, frecuencia]) => ({ palabra, frecuencia }));

  const positivas = [...new Set([...DEFAULT_POSITIVAS, ...customWords.positivas])];
  const negativas = [...new Set([...DEFAULT_NEGATIVAS, ...customWords.negativas])];

  const textoLower = texto.toLowerCase();
  let posCount = 0, negCount = 0;
  positivas.forEach((p) => { if (textoLower.includes(p.toLowerCase())) posCount++; });
  negativas.forEach((n) => { if (textoLower.includes(n.toLowerCase())) negCount++; });

  let categoria = 'OTROS';
  let mejorScore = 0;
  for (const cat of categorias) {
    if (!cat.activo) continue;
    const nombreCat = cat.nombre.toLowerCase();
    const descCat = (cat.descripcion || '').toLowerCase();
    const scoreNombre = textoLower.includes(nombreCat) ? 10 : 0;
    const palabrasDesc = descCat.split(/\s+/).filter(w => w.length > 3);
    const scoreDesc = palabrasDesc.filter(w => textoLower.includes(w)).length;
    const scoreTotal = scoreNombre + scoreDesc;
    if (scoreTotal > mejorScore) { mejorScore = scoreTotal; categoria = cat.nombre.toUpperCase(); }
  }
  if (mejorScore === 0) {
    if (textoLower.match(/compr|venta|adquir|producto|precio/)) categoria = 'VENTAS';
    else if (textoLower.match(/soporte|ayuda|técnic|repar|falla/)) categoria = 'SOPORTE';
    else if (textoLower.match(/reclamo|queja|malo|pésimo|defecto|estafa|fraude|mierda|carajo|puta|horrible|basura|asco/)) categoria = 'RECLAMO';
    else if (textoLower.match(/consulta|pregunt|información|duda/)) categoria = 'CONSULTA';
    else if (textoLower.match(/excelente|gracias|buen|feliz|satisfecho|genial|increíble|perfecto/)) categoria = 'FELICITACION';
  }

  const total = posCount + negCount || 1;
  const confianza = Math.min(95, Math.round(50 + (Math.abs(posCount - negCount) / total) * 45));

  let sentimiento: 'positivo' | 'negativo' | 'neutro' = 'neutro';
  if (posCount > negCount) sentimiento = 'positivo';
  else if (negCount > posCount) sentimiento = 'negativo';

  return { tokens, palabrasFrecuentes, categoria, confianza, sentimiento };
}

export const AnalizarComentario = () => {
  const [searchParams] = useSearchParams();
  const [texto, setTexto] = useState('');
  const [canal, setCanal] = useState('web');
  const [resultado, setResultado] = useState<ResultadoLocal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [recientes, setRecientes] = useState<AnalisisReciente[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDB[]>([]);
  const [customWords, setCustomWords] = useState<Record<string, string[]>>(loadCustomWords);
  const [newWord, setNewWord] = useState('');
  const [newWordType, setNewWordType] = useState('positivas');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showWordEditor, setShowWordEditor] = useState(false);

  useEffect(() => {
    const comentarioParam = searchParams.get('comentario');
    if (comentarioParam) setTexto(comentarioParam);
  }, [searchParams]);

  useEffect(() => { saveCustomWords(customWords); }, [customWords]);

  useEffect(() => {
    if (texto.trim() && categorias.length > 0 && !resultado) analizar();
  }, [texto, categorias]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [comentariosRes, catsRes] = await Promise.all([
          supabase
            .from('comentarios')
            .select('id, contenido, canal, fecha, analisis_nlp(idioma, categoria_detectada, confianza, palabras_frecuentes)')
            .eq('tipo', 'comentario')
            .order('fecha', { ascending: false })
            .limit(20),
          supabase
            .from('categorias')
            .select('id, nombre, descripcion, activo')
            .eq('activo', true)
        ]);
        if (comentariosRes.data) setRecientes(comentariosRes.data as unknown as AnalisisReciente[]);
        if (catsRes.data) setCategorias(catsRes.data as CategoriaDB[]);
      } catch { /* empty */ }
    };
    fetchData();
  }, []);

  const analizar = async () => {
    if (!texto.trim()) return;
    setCargando(true);
    const result = analizarConCategorias(texto, categorias, customWords);
    setResultado(result);
    setCargando(false);
  };

  const addWord = () => {
    if (!newWord.trim()) return;
    setCustomWords(prev => ({
      ...prev,
      [newWordType]: [...new Set([...(prev[newWordType] || []), newWord.trim().toLowerCase()])],
    }));
    setNewWord('');
  };

  const removeWord = (type: string, word: string) => {
    setCustomWords(prev => ({
      ...prev,
      [type]: (prev[type] || []).filter(w => w !== word),
    }));
  };

  const addCategory = () => {
    const name = newCategoryName.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || customWords[name]) return;
    setCustomWords(prev => ({ ...prev, [name]: [] }));
    setNewWordType(name);
    setNewCategoryName('');
  };

  const removeCategory = (type: string) => {
    setCustomWords(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    if (newWordType === type) setNewWordType('positivas');
  };

  const guardarEnBD = async () => {
    if (!resultado || !texto.trim()) return;
    setGuardando(true);
    try {
      const { data: comentario, error: err1 } = await supabase.from('comentarios').insert({
        contenido: texto,
        canal,
        tipo: 'comentario',
        estado: 'pendiente',
        procesado: true,
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
      const { data } = await supabase
        .from('comentarios')
        .select('id, contenido, canal, fecha, analisis_nlp(idioma, categoria_detectada, confianza, palabras_frecuentes)')
        .eq('tipo', 'comentario')
        .order('fecha', { ascending: false })
        .limit(20);
      if (data) setRecientes(data as unknown as AnalisisReciente[]);
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
          <p className="text-slate-500 text-sm mt-1">Analisis de sentimiento y clasificacion automatica</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Analisis local activo
          </span>
          <span className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            <Tag size={14} />
            {categorias.length} categorias DB
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Texto a Analizar</h3>
          </div>
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
          <textarea
            className="w-full h-40 p-4 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Pega aqui el comentario del cliente para analizarlo..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end mt-4">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              onClick={analizar}
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
                <p className="text-lg font-bold text-slate-800">{resultado.confianza}%</p>
                <div className="w-full h-2 bg-slate-200 rounded-full mt-2">
                  <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${resultado.confianza}%` }} />
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
                <Tag size={13} /> Categoria
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                  {resultado.categoria}
                </span>
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
              Ingresa un comentario y presiona "Analizar" para ver el resultado.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
        <button onClick={() => setShowWordEditor(!showWordEditor)} className="flex items-center gap-2 w-full text-left">
          <Tag size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700 flex-1">Palabras de Analisis (Admin)</h3>
          <span className="text-xs text-slate-400">{showWordEditor ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {showWordEditor && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-slate-500">Administra las palabras y categorias de analisis. Crea nuevos tipos, agrega o elimina palabras personalizadas.</p>
            
            <div className="flex gap-2">
              <select value={newWordType} onChange={e => setNewWordType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {Object.keys(customWords).map(k => (
                  <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                ))}
              </select>
              <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWord()}
                placeholder="Nueva palabra..." className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <button onClick={addWord} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">Agregar</button>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nueva categoria</label>
                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()}
                  placeholder=" Nombre de la categoria..." className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <button onClick={addCategory} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition">Crear Categoria</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(customWords).map(([key, words]) => {
                const isDefault = ['positivas', 'negativas', 'neutras'].includes(key);
                const color = key === 'positivas' ? 'emerald' : key === 'negativas' ? 'red' : key === 'neutras' ? 'slate' : 'blue';
                const defaults = key === 'positivas' ? DEFAULT_POSITIVAS : key === 'negativas' ? DEFAULT_NEGATIVAS : key === 'neutras' ? ['informacion','consulta','datos','estado','proceso','tiempo','fecha','numero','detalle','general'] : [];
                return (
                  <div key={key} className={`bg-${color}-50 rounded-lg p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs font-medium text-${color}-700 uppercase`}>{key} ({words.length} custom + {defaults.length} default)</p>
                      {!isDefault && (
                        <button onClick={() => removeCategory(key)} className="text-red-400 hover:text-red-600 text-xs" title="Eliminar categoria">x</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {words.map(w => (
                        <span key={`custom-${w}`} className={`px-2 py-0.5 bg-${color}-100 text-${color}-700 text-[10px] rounded-full flex items-center gap-1`}>
                          {w}
                          <button onClick={() => removeWord(key, w)} className={`text-${color}-400 hover:text-${color}-700`}>x</button>
                        </span>
                      ))}
                      {defaults.map(w => (
                        <span key={`default-${w}`} className={`px-2 py-0.5 bg-white text-${color}-600 text-[10px] rounded-full border border-${color}-200`}>{w}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Analisis Recientes</h3>
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
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
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
                      {(r.analisis_nlp as any)?.sentimiento === 'positivo' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium">
                          <ThumbsUp size={12} /> Positivo
                        </span>
                      ) : (r.analisis_nlp as any)?.sentimiento === 'negativo' ? (
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
