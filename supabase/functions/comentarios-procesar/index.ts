import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SPANISH_STOPWORDS = new Set([
  "de","la","que","el","en","y","a","los","del","se","las","por","un","para","con","no","una",
  "su","al","lo","como","mas","pero","sus","le","ya","o","este","si","porque","esta","entre",
]);
function normalize(t: string) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function tokenize(t: string) { return normalize(t).match(/\b[a-záéíóúñ]{2,}\b/g) || []; }

const CATS: Record<string, string[]> = {
  VENTAS: ["factura","precio","costo","comprar","plan","pago","cotizar","presupuesto"],
  RECLAMO: ["error","falla","lento","problema","queja","reclamo","molesto","horrible","cancelar"],
  FELICITACION: ["gracias","excelente","bueno","rapido","satisfecho","genial","perfecto","recomiendo"],
  SOPORTE: ["sistema","contrasena","acceso","login","soporte","tecnico","bug","aplicacion","ayuda"],
};

function clasificar(texto: string) {
  const tokens = tokenize(texto).filter((t) => !SPANISH_STOPWORDS.has(t) && t.length > 2);
  const scores: Record<string, number> = { VENTAS:0, RECLAMO:0, FELICITACION:0, SOPORTE:0 };
  for (const t of tokens) {
    for (const [cat, kws] of Object.entries(CATS)) {
      if (kws.some((kw) => t.includes(kw) || kw.includes(t))) scores[cat] += 2;
    }
  }
  const max = Math.max(...Object.values(scores));
  return max > 0 ? Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a)[0] : "CONSULTA";
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/");
    const comentarioId = parts[parts.length - 2];

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: comentario } = await supabase
      .from("comentarios").select("*").eq("id", comentarioId).maybeSingle();

    if (!comentario) return jsonResponse({ error: "Comentario no encontrado" }, 404);

    const categoria = clasificar(comentario.contenido || "");
    const tokens = tokenize(comentario.contenido || "").filter((t) => !SPANISH_STOPWORDS.has(t));
    const keywords = [...new Set(tokens)].slice(0, 6);

    await supabase.from("comentarios").update({
      categoria,
      keywords,
      procesado: true,
      estado: "procesado",
    }).eq("id", comentarioId);

    await supabase.from("analisis_nlp").insert({
      comentario_id: comentarioId,
      categoria_detectada: categoria,
      keywords,
      idioma: "es",
      cantidad_palabras: tokens.length,
    });

    return jsonResponse({ ok: true, categoria, keywords });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
