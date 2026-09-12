import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

function calcularEstadisticas(valores: number[]) {
  const n = valores.length;
  const sorted = [...valores].sort((a, b) => a - b);
  const mean = valores.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];
  const variance = valores.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const p25 = sorted[Math.floor(n * 0.25)];
  const p75 = sorted[Math.floor(n * 0.75)];
  return {
    cantidad: n,
    media: Math.round(mean * 100) / 100,
    mediana: Math.round(median * 100) / 100,
    desviacion_estandar: Math.round(stddev * 100) / 100,
    minimo: sorted[0],
    maximo: sorted[n - 1],
    percentil_25: Math.round(p25 * 100) / 100,
    percentil_75: Math.round(p75 * 100) / 100,
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const valores = body.valores;
    if (!Array.isArray(valores) || valores.length === 0) {
      return jsonResponse({ error: "Se requiere un array de valores" }, 400);
    }
    return jsonResponse(calcularEstadisticas(valores));
  } catch {
    return jsonResponse({ error: "Error procesando solicitud" }, 500);
  }
});
