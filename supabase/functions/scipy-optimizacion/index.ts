import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

function minimize(
  costo: (x: number[]) => number,
  x0: number[],
  method = "nelder-mead"
): { x: number[]; fun: number; nit: number; success: boolean } {
  let x = [...x0];
  let fx = costo(x);
  let nit = 0;
  const maxIter = 200;
  const alpha = 1.0, gamma = 2.0, rho = 0.5, sigma = 0.5;
  const n = x.length;
  let simplex: number[][] = [x];
  for (let i = 0; i < n; i++) {
    const xi = [...x];
    xi[i] = xi[i] || 0.01;
    simplex.push(xi);
  }
  let fSimplex = simplex.map((s) => costo(s));
  for (nit = 0; nit < maxIter; nit++) {
    const sorted = fSimplex
      .map((f, i) => ({ f, i }))
      .sort((a, b) => a.f - b.f);
    const best = sorted[0];
    const worst = sorted[n];
    const secondWorst = sorted[n - 1];
    const centroid = new Array(n).fill(0);
    for (let i = 0; i <= n; i++) {
      if (i !== worst.i) {
        for (let j = 0; j < n; j++) centroid[j] += simplex[i][j];
      }
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;
    const reflected = centroid.map(
      (c, j) => c + alpha * (c - simplex[worst.i][j])
    );
    const fReflected = costo(reflected);
    if (fReflected < fSimplex[secondWorst.i] && fReflected >= fSimplex[best.i]) {
      simplex[worst.i] = reflected;
      fSimplex[worst.i] = fReflected;
    } else if (fReflected < fSimplex[best.i]) {
      const expanded = centroid.map(
        (c, j) => c + gamma * (reflected[j] - c)
      );
      const fExpanded = costo(expanded);
      if (fExpanded < fReflected) {
        simplex[worst.i] = expanded;
        fSimplex[worst.i] = fExpanded;
      } else {
        simplex[worst.i] = reflected;
        fSimplex[worst.i] = fReflected;
      }
    } else {
      const contracted = centroid.map(
        (c, j) => c + rho * (simplex[worst.i][j] - c)
      );
      const fContracted = costo(contracted);
      if (fContracted < fSimplex[worst.i]) {
        simplex[worst.i] = contracted;
        fSimplex[worst.i] = fContracted;
      } else {
        for (let i = 0; i <= n; i++) {
          for (let j = 0; j < n; j++) {
            simplex[i][j] = simplex[best.i][j] + sigma * (simplex[i][j] - simplex[best.i][j]);
          }
          fSimplex[i] = costo(simplex[i]);
        }
      }
    }
    const fMin = Math.min(...fSimplex);
    const fMax = Math.max(...fSimplex);
    if (fMax - fMin < 1e-8) break;
  }
  const bestIdx = fSimplex.indexOf(Math.min(...fSimplex));
  return { x: simplex[bestIdx], fun: fSimplex[bestIdx], nit, success: true };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const params = body.parametros_entrada || body;
    const keys = Object.keys(params);
    const x0 = keys.map((k) => Number(params[k]) || 1);

    const costo = (x: number[]) =>
      x.reduce((s, v) => s + (v - 1) ** 2, 0) + 0.1 * x.reduce((s, v) => s + v, 0);

    const result = minimize(costo, x0);
    const resultado: Record<string, number> = {};
    keys.forEach((k, i) => (resultado[k] = Math.round(result.x[i] * 100) / 100));

    return jsonResponse({
      nombre: body.nombre || "Escenario Optimizado",
      parametros_entrada: params,
      resultado,
      costo_optimizado: Math.round(result.fun * 100) / 100,
      convergio: result.success,
      iteraciones: result.nit,
    });
  } catch {
    return jsonResponse({ error: "Error en optimizacion" }, 500);
  }
});
