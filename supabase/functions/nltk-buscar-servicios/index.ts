import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const SERVICIOS = [
  { id:1, nombre:"Soporte Tecnico", descripcion:"Ayuda con problemas tecnicos, errores del sistema, configuracion y acceso", categoria:"SOPORTE", keywords:["error","bug","problema","acceso","login","contrasena","sistema","configurar","pantalla","ayuda","tecnico","computadora","equipo","dispositivo","impresora","red","internet","conexion","servidor"] },
  { id:2, nombre:"Atencion al Cliente", descripcion:"Consultas generales, informacion y seguimiento de casos", categoria:"SOPORTE", keywords:["consulta","informacion","seguimiento","caso","duda","pregunta","ayuda","orientacion","detalles"] },
  { id:3, nombre:"Planes y Precios", descripcion:"Informacion sobre planes de suscripcion, costos y facturacion", categoria:"VENTAS", keywords:["precio","costo","plan","suscripcion","factura","pago","cotizar","presupuesto","tarifa","cuota"] },
  { id:4, nombre:"Consultas Comerciales", descripcion:"Asesoria comercial, negociaciones y propuestas empresariales", categoria:"VENTAS", keywords:["comprar","contratar","asesor","comercial","negocio","empresa","descuento","oferta","promocion"] },
  { id:5, nombre:"Quejas y Reclamos", descripcion:"Registro y gestion de quejas, reclamos y solicitudes de mejora", categoria:"RECLAMO", keywords:["queja","reclamo","molesto","problema","insatisfecho","cancelar","devolver"] },
  { id:6, nombre:"Sugerencias", descripcion:"Recepcion de sugerencias y feedback para mejorar el servicio", categoria:"FELICITACION", keywords:["sugerencia","idea","mejorar","feedback","opinion","recomendar"] },
];

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const STOPWORDS = new Set(["de","la","que","el","en","y","a","los","del","se","las","por","un","para","con","no","una","su","al","lo","como","mas","pero","sus","le","ya","o","este","si","porque","esta","entre","cuando","muy","sin","sobre","tambien","me","hasta","hay","donde","quien","desde","todo","nos"]);

function search(consulta: string) {
  const tokens = normalize(consulta).match(/\b[a-záéíóúñ]{2,}\b/g) || [];
  const queryTokens = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 2);
  if (queryTokens.length === 0) return [];

  const results = SERVICIOS.map((s) => {
    const serviceTokens = new Set([
      ...s.keywords.map((k) => normalize(k)),
      ...normalize(s.descripcion).match(/\b[a-záéíóúñ]{2,}\b/g) || [],
    ]);
    const matches = queryTokens.filter((t) => serviceTokens.has(t));
    const score = matches.length / queryTokens.length;
    return { ...s, score: Math.round(score * 100) / 100, coincidencias: matches };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

  if (results.length === 0) {
    return SERVICIOS.filter((s) => queryTokens.some((t) => normalize(s.categoria).includes(t)))
      .map((s) => ({ ...s, score: 0.1, coincidencias: [s.categoria.toLowerCase()] }));
  }
  return results;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const body = await req.json();
    const consulta = body.consulta || "";
    if (!consulta) return jsonResponse({ servicios: [], tokens: [] });
    const tokens = normalize(consulta).match(/\b[a-záéíóúñ]{2,}\b/g) || [];
    return jsonResponse({ consulta, tokens: tokens.filter((t) => !STOPWORDS.has(t)), servicios: search(consulta) });
  } catch {
    return jsonResponse({ error: "Error buscando servicios" }, 500);
  }
});
