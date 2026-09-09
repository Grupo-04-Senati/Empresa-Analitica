import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "No autorizado" }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Token invalido" }, 401);

    const { data: profile } = await supabase
      .from("usuarios").select("rol").eq("email", user.email).maybeSingle();
    if (!profile || profile.rol !== "ADMIN") return jsonResponse({ error: "Solo administradores" }, 403);

    if (req.method === "GET") {
      const { data: usuarios } = await supabase
        .from("usuarios").select("id, nombre, email, rol, activo, created_at").order("created_at", { ascending: false });
      return jsonResponse(usuarios || []);
    }

    if (req.method === "PUT") {
      const url = new URL(req.url);
      const parts = url.pathname.split("/");
      const usuarioId = parts[parts.length - 2];
      const body = await req.json();
      if (body.nuevo_rol) {
        await supabase.from("usuarios").update({ rol: body.nuevo_rol }).eq("id", usuarioId);
      }
      if (body.activo !== undefined) {
        await supabase.from("usuarios").update({ activo: body.activo }).eq("id", usuarioId);
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Metodo no soportado" }, 405);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
