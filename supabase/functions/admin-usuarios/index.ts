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

    /*
     * DELETE: borra la cuenta por completo, incluido el usuario de Supabase
     * Auth, que solo se puede tocar con la service_role.
     *
     * Antes esto se hacia desde el navegador con la service_role incrustada en
     * el bundle (frontend/.env VITE_SUPABASE_SERVICE_KEY): cualquiera que
     * abriera el JavaScript publicado tenia acceso total a la base. La clave
     * vive aqui, en Deno.env, y nunca sale al cliente.
     *
     * Lo permite un ADMIN sobre cualquier cuenta, o cualquier usuario sobre su
     * PROPIA cuenta (borrar mi perfil desde /perfil).
     */
    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      const emailObjetivo: string | undefined = body.email;
      if (!emailObjetivo) return jsonResponse({ error: "Falta el email" }, 400);

      const esAdmin = profile.rol === "ADMIN";
      const esSuPropiaCuenta =
        user.email?.toLowerCase() === emailObjetivo.toLowerCase();
      if (!esAdmin && !esSuPropiaCuenta) {
        return jsonResponse({ error: "Solo puedes borrar tu propia cuenta" }, 403);
      }

      const { data: objetivo } = await supabase
        .from("usuarios").select("id, email").eq("email", emailObjetivo).maybeSingle();

      if (objetivo) {
        // El orden importa: las tablas hijas antes que `usuarios`.
        await supabase.from("rostros").delete().eq("usuario_id", objetivo.id);
        await supabase.from("auditoria").delete().eq("usuario_id", objetivo.id);
        await supabase.from("optimizaciones").delete().eq("usuario_id", objetivo.id);
        await supabase.from("notificaciones").delete().eq("usuario_email", objetivo.email);
        await supabase.from("usuarios").delete().eq("id", objetivo.id);
      }

      // Usuario de Auth: hay que buscarlo por email porque el id es un UUID
      // distinto del id de la tabla `usuarios`.
      let authBorrado = false;
      const { data: lista } = await supabase.auth.admin.listUsers();
      const authUser = lista?.users?.find(
        (u) => u.email?.toLowerCase() === emailObjetivo.toLowerCase()
      );
      if (authUser) {
        const { error } = await supabase.auth.admin.deleteUser(authUser.id);
        authBorrado = !error;
      }

      return jsonResponse({
        ok: true,
        perfilBorrado: !!objetivo,
        authBorrado,
      });
    }

    return jsonResponse({ error: "Metodo no soportado" }, 405);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
