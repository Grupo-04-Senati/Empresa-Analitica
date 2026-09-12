import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const SPANISH_STOPWORDS = new Set([
  "de","la","que","el","en","y","a","los","del","se","las","por","un","para","con","no","una",
  "su","al","lo","como","mas","pero","sus","le","ya","o","este","si","porque","esta","entre",
  "cuando","muy","sin","sobre","tambien","me","hasta","hay","donde","quien","desde","todo","nos",
]);

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(text: string): string[] {
  return normalize(text).match(/\b[a-záéíóúñ]{2,}\b/g) || [];
}

function extractFeatures(text: string): Set<string> {
  const tokens = tokenize(text).filter((t) => !SPANISH_STOPWORDS.has(t) && t.length > 2);
  return new Set(tokens);
}

const TRAINING_DATA: [string, string][] = [
  ["quiero comprar un plan empresarial","VENTAS"],["cuanto cuesta el servicio mensual","VENTAS"],
  ["necesito una cotizacion para mi empresa","VENTAS"],["que planes de suscripcion ofrecen","VENTAS"],
  ["dame informacion de precios y descuentos","VENTAS"],["quiero contratar el plan premium","VENTAS"],
  ["hay promociones para nuevos clientes","VENTAS"],["necesito generar una factura","VENTAS"],
  ["cual es el costo del plan basico","VENTAS"],["quisiera hablar con un asesor comercial","VENTAS"],
  ["envieme el presupuesto actualizado","VENTAS"],["que beneficios incluye el plan gold","VENTAS"],
  ["cuanto vale la licencia anual","VENTAS"],["informacion de tarifas disponibles","VENTAS"],
  ["necesito un devis para el servicio","VENTAS"],
  ["no puedo ingresar a mi cuenta","SOPORTE"],["olvide mi contrasena y no puedo acceder","SOPORTE"],
  ["el sistema presenta un error constante","SOPORTE"],["necesito ayuda tecnica con la plataforma","SOPORTE"],
  ["la aplicacion se cierra sola","SOPORTE"],["no me funciona el login","SOPORTE"],
  ["tengo un problema con mi acceso","SOPORTE"],["como configuro mi perfil","SOPORTE"],
  ["necesito soporte con la configuracion","SOPORTE"],["la pantalla se ve corrupta","SOPORTE"],
  ["hay un bug en el modulo de reportes","SOPORTE"],["no carga la pagina principal","SOPORTE"],
  ["mi conexion con el servidor falla","SOPORTE"],["necesito recuperar mi cuenta bloqueada","SOPORTE"],
  ["el boton de enviar no responde","SOPORTE"],["necesito ayuda con mi computadora","SOPORTE"],
  ["el servicio es muy lento y pesimo","RECLAMO"],["estoy muy molesto con la atencion recibida","RECLAMO"],
  ["esto es inaceptable y quiero hablar con un supervisor","RECLAMO"],["llevo esperando tres horas y nada","RECLAMO"],
  ["el producto llego danado y defectuoso","RECLAMO"],["nunca me han dado una respuesta satisfactoria","RECLAMO"],
  ["quiero presentar una queja formal","RECLAMO"],["esto es un desastre total","RECLAMO"],
  ["el servicio al cliente es horrible","RECLAMO"],["voy a cancelar mi suscripcion por mal servicio","RECLAMO"],
  ["tardaron demasiado en resolver mi problema","RECLAMO"],["la calidad ha bajado muchisimo","RECLAMO"],
  ["no cumplieron con lo prometido","RECLAMO"],["esto es una estafa total","RECLAMO"],
  ["la demora es inaceptable","RECLAMO"],
  ["excelente servicio, muy satisfecho","FELICITACION"],["gracias por la rapida atencion","FELICITACION"],
  ["el equipo fue muy amable y eficiente","FELICITACION"],["recomiendo totalmente este servicio","FELICITACION"],
  ["todo perfecto, sin problemas","FELICITACION"],["me encanta la plataforma, es intuitiva","FELICITACION"],
  ["gran experiencia con el soporte tecnico","FELICITACION"],["muy buen servicio, lo recomiendo","FELICITACION"],
  ["la atencion fue impecable","FELICITACION"],["resolvieron mi problema rapido y bien","FELICITACION"],
  ["excelente calidad y precio","FELICITACION"],["me gusto mucho el trato recibido","FELICITACION"],
  ["son los mejores del mercado","FELICITACION"],["agradecido con el servicio brindado","FELICITACION"],
  ["super felicitaciones al equipo","FELICITACION"],
];

interface CategoryProb { cat: string; count: number; words: Map<string, number>; totalWords: number; }
const categoryData: Map<string, CategoryProb> = new Map();
const allWords = new Set<string>();
let totalDocs = 0;

for (const [text, cat] of TRAINING_DATA) {
  const features = extractFeatures(text);
  totalDocs++;
  if (!categoryData.has(cat)) categoryData.set(cat, { cat, count: 0, words: new Map(), totalWords: 0 });
  const cd = categoryData.get(cat)!;
  cd.count++;
  for (const w of features) {
    cd.words.set(w, (cd.words.get(w) || 0) + 1);
    cd.totalWords++;
    allWords.add(w);
  }
}

function classify(text: string): { categoria: string; confianza: number; detalles: Record<string, number> } {
  const features = extractFeatures(text);
  const vocabSize = allWords.size;
  const logProbs: Record<string, number> = {};
  for (const [cat, cd] of categoryData) {
    let logP = Math.log(cd.count / totalDocs);
    for (const w of features) {
      const wordCount = cd.words.get(w) || 0;
      logP += Math.log((wordCount + 1) / (cd.totalWords + vocabSize));
    }
    logProbs[cat] = logP;
  }
  const maxLog = Math.max(...Object.values(logProbs));
  const expLog: Record<string, number> = {};
  let sumExp = 0;
  for (const [cat, lp] of Object.entries(logProbs)) {
    expLog[cat] = Math.exp(lp - maxLog);
    sumExp += expLog[cat];
  }
  const probs: Record<string, number> = {};
  for (const [cat, el] of Object.entries(expLog)) probs[cat] = Math.round((el / sumExp) * 1000) / 10;
  const best = Object.entries(probs).reduce((a, b) => (b[1] > a[1] ? b : a));
  return { categoria: best[0], confianza: best[1], detalles: probs };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const body = await req.json();
    if (body.texto) {
      const result = classify(body.texto);
      return jsonResponse({ ...result, metodo: "naive_bayes", ejemplos_entrenamiento: TRAINING_DATA.length });
    }
    if (body.comentarios) {
      const results = body.comentarios.map((c: { texto?: string; contenido?: string }) => {
        const texto = c.texto || c.contenido || "";
        const r = classify(texto);
        return { ...c, categoria: r.categoria, confianza: r.confianza, sentimiento: r.categoria === "FELICITACION" ? "positivo" : r.categoria === "RECLAMO" ? "negativo" : "neutro" };
      });
      return jsonResponse(results);
    }
    return jsonResponse({ error: "Especifique 'texto' o 'comentarios'" }, 400);
  } catch {
    return jsonResponse({ error: "Error clasificando texto" }, 500);
  }
});
