import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const SPANISH_STOPWORDS = new Set([
  "de","la","que","el","en","y","a","los","del","se","las","por","un","para","con","no","una",
  "su","al","lo","como","mas","pero","sus","le","ya","o","este","si","porque","esta","entre",
  "cuando","muy","sin","sobre","tambien","me","hasta","hay","donde","quien","desde","todo","nos",
  "durante","todos","uno","les","ni","contra","otros","ese","eso","ante","ellos","e","esto","mi",
  "mis","tus","tu","es","fue","son","era","han","he","ha","somos","estan"
]);

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(text: string): string[] {
  return normalize(text).match(/\b[a-záéíóúñ]{2,}\b/g) || [];
}

const CATEGORIA_KEYWORDS: Record<string, string[]> = {
  VENTAS: ["factura","facturacion","precio","precios","costo","costos","comprar","compra","plan","planes","contrato","pagar","pago","descuento","tarifa","cotizacion","cotizar","presupuesto","ventas"],
  RECLAMO: ["error","falla","lento","demora","pesimo","problema","inaceptable","terrible","queja","reclamo","molesto","molestia","danado","defectuoso","mal","malo","mala","tarde","estafa","caro","desastre","horrible","cancelar"],
  FELICITACION: ["gracias","excelente","bueno","buena","rapido","rapida","felicitaciones","satisfecho","genial","perfecto","agradable","eficiente","recomiendo","impecable","agradecido","encanta"],
  SOPORTE: ["sistema","contrasena","clave","acceso","login","pantalla","soporte","tecnico","bug","plataforma","aplicacion","app","cuenta","conexion","configurar","ayuda"],
};

const POSITIVAS = new Set([...CATEGORIA_KEYWORDS.FELICITACION, "util","atento","amable","gusto","positivo"]);
const NEGATIVAS = new Set([...CATEGORIA_KEYWORDS.RECLAMO, "inutil","nunca","negativo","abuso","injusto"]);

function analizarTexto(texto: string) {
  if (!texto?.trim()) {
    return { idioma:"es", cantidad_palabras:0, tokens:[], keywords:[], temas:["General"], palabras_frecuentes:[], categoria:"CONSULTA", categoria_detectada:"CONSULTA", sentimiento:"neutro", confianza:80 };
  }
  const tokens = tokenize(texto);
  const limpios = tokens.filter((t) => !SPANISH_STOPWORDS.has(t) && t.length > 2);

  const scores: Record<string, number> = { VENTAS:0, RECLAMO:0, FELICITACION:0, SOPORTE:0 };
  for (const t of limpios) {
    for (const [cat, kws] of Object.entries(CATEGORIA_KEYWORDS)) {
      if (kws.some((kw) => t === kw || (kw.length > 4 && t.startsWith(kw.slice(0, 4))))) scores[cat] += 2;
    }
  }
  const norm = normalize(texto);
  if (["muchas gracias","muy bueno","excelente atencion","buen servicio","me encanta"].some((p) => norm.includes(p))) scores.FELICITACION += 5;
  if (["no funciona","muy lento","pesimo servicio","mala atencion","no sirve"].some((p) => norm.includes(p))) scores.RECLAMO += 5;
  if (["no puedo ingresar","olvide mi clave","error en el sistema","soporte tecnico"].some((p) => norm.includes(p))) scores.SOPORTE += 5;
  if (["cuanto cuesta","planes disponibles","quiero comprar","generar factura"].some((p) => norm.includes(p))) scores.VENTAS += 5;

  let categoria = "CONSULTA";
  let confianza = 85;
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0) {
    categoria = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    confianza = Math.min(98, 75 + maxScore * 5);
  }

  const posM = limpios.filter((t) => [...POSITIVAS].some((kw) => t === kw || (kw.length > 4 && t.startsWith(kw.slice(0, 4))))).length;
  const negM = limpios.filter((t) => [...NEGATIVAS].some((kw) => t === kw || (kw.length > 4 && t.startsWith(kw.slice(0, 4))))).length;
  let sentimiento = "neutro";
  if (categoria === "FELICITACION" || posM > negM) sentimiento = "positivo";
  else if (categoria === "RECLAMO" || negM > posM) sentimiento = "negativo";

  const conteo: Record<string, number> = {};
  limpios.forEach((t) => (conteo[t] = (conteo[t] || 0) + 1));
  const palabrasFrecuentes = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([palabra, frecuencia]) => ({ palabra, frecuencia }));
  const keywords = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);

  const temasMap: Record<string, string[]> = {
    VENTAS: ["Facturacion","Planes Comerciales"], RECLAMO: ["Calidad de Servicio","Incidencias"],
    FELICITACION: ["Satisfaccion","Calidad de Servicio"], SOPORTE: ["Soporte Tecnico","Sistemas"],
    CONSULTA: ["Atencion al Cliente","Informacion General"],
  };

  return {
    idioma: "es", cantidad_palabras: limpios.length, tokens: limpios, keywords,
    temas: temasMap[categoria] || ["Atencion al Cliente"], palabras_frecuentes: palabrasFrecuentes,
    categoria, categoria_detectada: categoria, sentimiento, confianza: Math.round(confianza * 10) / 10,
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const body = await req.json();
    if (!body.texto) return jsonResponse({ error: "Se requiere campo 'texto'" }, 400);
    return jsonResponse(analizarTexto(body.texto));
  } catch {
    return jsonResponse({ error: "Error procesando texto" }, 500);
  }
});
