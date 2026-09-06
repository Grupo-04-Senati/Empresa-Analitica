import { useState, useEffect } from 'react';
import {
  BrainCircuit, Send, Sparkles, Tag, Hash, Loader2,
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
  } | null;
}

interface ResultadoLocal {
  tokens: string[];
  palabrasFrecuentes: { palabra: string; frecuencia: number }[];
  categoria: string;
  confianza: number;
}

const STOPWORDS_ES = new Set(['de','la','el','en','y','a','los','del','las','un','por','con','una','su','para','es','al','lo','como','más','o','pero','sus','le','ya','este','ha','sí','porque','esta','son','entre','cuando','muy','sin','sobre','también','me','hasta','hay','donde','quien','desde','todo','nos','durante','todos','uno','les','ni','contra','otros','ese','eso','ante','ellos','e','esto','mí','antes','algunos','qué','unos','yo','otro','otras','otra','él','tanto','esa','estos','mucho','quienes','nada','muchos','cual','poco','ella','estar','estas','algunas','algo','nosotros','mi','mis','tú','te','ti','tu','tus','ellas','nosotras','vosotros','vosotras','os','mío','mía','míos','mías','tuyo','tuya','tuyos','tuyas','suyo','suya','suyos','suyas','nuestro','nuestra','nuestros','nuestras','vuestro','vuestra','vuestros','vuestras','esos','esas','estoy','estás','está','estamos','estáis','están','esté','estés','estemos','estéis','estén','estaré','estarás','estará','estaremos','estaréis','estarán','estaría','estarías','estaríamos','estaríais','estarían','estaba','estabas','estábamos','estabais','estaban','estuve','estuviste','estuvo','estuvimos','estuvisteis','estuvieron','estuviera','estuvieras','estuviéramos','estuvierais','estuvieran','estuviese','estuvieses','estuviésemos','estuvieseis','estuviesen','estando','estado','estada','estados','estadas','estad','he','has','ha','hemos','habéis','han','haya','hayas','hayamos','hayáis','hayan','habré','habrás','habrá','habremos','habréis','habrán','habría','habrías','habríamos','habríais','habrían','había','habías','habíamos','habíais','habían','hube','hubiste','hubo','hubimos','hubisteis','hubieron','hubiera','hubieras','hubiéramos','hubierais','hubieran','hubiese','hubieses','hubiésemos','hubieseis','hubiesen','habiendo','habido','habida','habidos','habidas','soy','eres','es','somos','sois','son','sea','seas','seamos','seáis','sean','seré','serás','será','seremos','seréis','serán','sería','serías','seríamos','seríais','serían','fui','fuiste','fue','fuimos','fuisteis','fueron','fuera','fueras','fuéramos','fuerais','fueran','fuese','fueses','fuésemos','fueseis','fuesen','siendo','sido','tengo','tienes','tiene','tenemos','tenéis','tienen','tenga','tengas','tengamos','tengáis','tengan','tendré','tendrás','tendrá','tendremos','tendréis','tendrán','tendría','tendrías','tendríamos','tendríais','tendrían','tenía','tenías','teníamos','teníais','tenían','tuve','tuviste','tuvo','tuvimos','tuvisteis','tuvieron','tuviera','tuvieras','tuviéramos','tuvierais','tuvieran','tuviese','tuvieses','tuviésemos','tuvieseis','tuviesen','teniendo','tenido','tenida','tenidos','tenidas','tened']);

function analizarConCategorias(texto: string, categorias: CategoriaDB[]): ResultadoLocal {
  const limpio = texto.toLowerCase().replace(/[^\w\sáéíóúñ]/g, ' ');
  const tokens = limpio.split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS_ES.has(t));
  const freq: Record<string, number> = {};
  tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
  const palabrasFrecuentes = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([palabra, frecuencia]) => ({ palabra, frecuencia }));

  const positivas = ['excelente','bueno','buen','muy bien','genial','increíble','perfecto','agradecido','gracias','feliz','satisfecho','recomiendo','me gusta','maravilloso','fantástico','rápido','eficiente'];
  const negativas = ['malo','terrible','pésimo','horrible','lento','error','problema','queja','reclamo','insatisfecho','decepcionado','no funciona','no sirve','muy lento','deficiente','lamentable'];

  let posCount = 0, negCount = 0;
  const textoLower = texto.toLowerCase();
  positivas.forEach((p) => { if (textoLower.includes(p)) posCount++; });
  negativas.forEach((n) => { if (textoLower.includes(n)) negCount++; });

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
    if (scoreTotal > mejorScore) {
      mejorScore = scoreTotal;
      categoria = cat.nombre.toUpperCase();
    }
  }

  if (mejorScore === 0) {
    if (textoLower.match(/compr|venta|adquir|producto|precio/)) categoria = 'VENTAS';
    else if (textoLower.match(/soporte|ayuda|técnic|repar|falla/)) categoria = 'SOPORTE';
    else if (textoLower.match(/reclamo|queja|malo|pésimo|defecto/)) categoria = 'RECLAMO';
    else if (textoLower.match(/consulta|pregunt|información|duda/)) categoria = 'CONSULTA';
    else if (textoLower.match(/excelente|gracias|buen|feliz|satisfecho/)) categoria = 'FELICITACION';
  }

  const total = posCount + negCount || 1;
  const confianza = Math.min(95, Math.round(50 + (Math.abs(posCount - negCount) / total) * 45));

  return { tokens, palabrasFrecuentes, categoria, confianza };
}

export const AnalizarComentario = () => {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<ResultadoLocal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [recientes, setRecientes] = useState<AnalisisReciente[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDB[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [comentariosRes, catsRes] = await Promise.all([
          supabase
            .from('comentarios')
            .select('id, contenido, canal, fecha, analisis_nlp(idioma, categoria_detectada, confianza, palabras_frecuentes)')
            .eq('procesado', true)
            .order('fecha', { ascending: false })
            .limit(10),
          supabase
            .from('categorias')
            .select('id, nombre, descripcion, activo')
            .eq('activo', true)
        ]);
        if (comentariosRes.data) setRecientes(comentariosRes.data as unknown as AnalisisReciente[]);
        if (catsRes.data) setCategorias(catsRes.data as CategoriaDB[]);
      } catch {
        /* empty */
      }
    };
    fetchData();
  }, []);

  const analizar = async () => {
    if (!texto.trim()) return;
    setCargando(true);
    const result = analizarConCategorias(texto, categorias);
    setResultado(result);
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Analizar Comentario</h2>
          <p className="text-slate-500 text-sm mt-1">Análisis de sentimiento y clasificación automática</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Análisis local activo
          </span>
          <span className="inline-flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            <Tag size={14} />
            {categorias.length} categorías DB
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-700">Texto a Analizar</h3>
          </div>
          <textarea
            className="w-full h-40 p-4 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Pega aquí el comentario del cliente para analizarlo..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end mt-4">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              onClick={analizar}
              disabled={cargando || !texto.trim()}
            >
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {cargando ? 'Analizando...' : 'Analizar'}
            </button>
          </div>
        </div>

        {resultado ? (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={18} className="text-blue-600" />
              <h3 className="font-semibold text-slate-700">Resultado del Análisis</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Tokens procesados</p>
                <p className="text-lg font-bold text-slate-800">{resultado.tokens.length}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Categoría detectada</p>
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
                <p className="text-xs text-slate-500 mb-1">Palabras únicas</p>
                <p className="text-lg font-bold text-slate-800">{new Set(resultado.tokens).size}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                <Hash size={13} /> Palabras más frecuentes
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
                <Tag size={13} /> Categoría
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
            <p className="font-semibold text-slate-700 mb-1">Esperando análisis</p>
            <p className="text-sm text-slate-400 max-w-xs">
              Ingresa un comentario y presiona "Analizar" para ver el resultado.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-blue-600" />
          <h3 className="font-semibold text-slate-700">Análisis Recientes</h3>
        </div>
        {recientes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No hay análisis recientes en la base de datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Fecha</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Canal</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Comentario</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Categoría</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Confianza</th>
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

export default AnalizarComentario;
