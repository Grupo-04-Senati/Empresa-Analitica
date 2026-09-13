export interface OptimResult {
  variables: Record<string, number>;
  costo_inicial: number;
  costo_optimizado: number;
  ahorro: number;
  converge: boolean;
  iteraciones: number;
  metodo: string;
}

function gradientDescent(
  f: (x: number[]) => number,
  x0: number[],
  options: { maxIter?: number; lr?: number; constraints?: (x: number[]) => boolean; bounds?: [number, number][] } = {}
): { x: number[]; fx: number; iter: number; converge: boolean } {
  const { maxIter = 500, lr = 0.01, constraints, bounds } = options;
  let x = [...x0];
  let bestX = [...x];
  let bestFx = f(x);
  const eps = 1e-6;

  for (let iter = 0; iter < maxIter; iter++) {
    const grad: number[] = [];
    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      x[i] = xi + eps;
      const fp = f(x);
      x[i] = xi - eps;
      const fm = f(x);
      x[i] = xi;
      grad.push((fp - fm) / (2 * eps));
    }

    for (let i = 0; i < x.length; i++) {
      x[i] = x[i] - lr * grad[i];
      if (bounds && bounds[i]) {
        x[i] = Math.max(bounds[i][0], Math.min(bounds[i][1], x[i]));
      }
    }

    if (constraints && !constraints(x)) {
      for (let i = 0; i < x.length; i++) x[i] = bestX[i] + (Math.random() - 0.5) * 0.1;
    }

    const fx = f(x);
    if (fx < bestFx) { bestFx = fx; bestX = [...x]; }
  }

  return { x: bestX, fx: bestFx, iter: maxIter, converge: true };
}

export function optimizarCostos(params: { recurso_a: number; recurso_b: number }): OptimResult {
  const { recurso_a, recurso_b } = params;
  const costoInicial = 80 * recurso_a + 50 * recurso_b + 10 * (recurso_a - 3) ** 2 + 5 * (recurso_b - 2) ** 2;

  const f = (x: number[]) => 80 * x[0] + 50 * x[1] + 10 * (x[0] - 3) ** 2 + 5 * (x[1] - 2) ** 2;
  const constraint = (x: number[]) => 10 * x[0] + 5 * x[1] >= 40;
  const result = gradientDescent(f, [recurso_a, recurso_b], { lr: 0.005, bounds: [[0, 10], [0, 10]], constraints: constraint, maxIter: 1000 });

  const costoOpt = f(result.x);
  return {
    variables: { recurso_a: Math.round(result.x[0] * 100) / 100, recurso_b: Math.round(result.x[1] * 100) / 100 },
    costo_inicial: Math.round(costoInicial * 100) / 100,
    costo_optimizado: Math.round(costoOpt * 100) / 100,
    ahorro: Math.round((costoInicial - costoOpt) * 100) / 100,
    converge: result.converge, iteraciones: result.iter, metodo: 'gradiente-descendente',
  };
}

export function optimizarOperadores(params: { web: number; telefono: number; presencial: number; costoWeb: number; costoTel: number; costoPres: number; demandaWeb: number; demandaTel: number; demandaPres: number }): OptimResult {
  const { costoWeb = 15, costoTel = 20, costoPres = 25, demandaWeb = 30, demandaTel = 20, demandaPres = 15 } = params;
  const costoInicial = params.web * costoWeb + params.telefono * costoTel + params.presencial * costoPres;

  const f = (x: number[]) => x[0] * costoWeb + x[1] * costoTel + x[2] * costoPres +
    100 * Math.max(0, demandaWeb - x[0] * 10) ** 2 +
    100 * Math.max(0, demandaTel - x[1] * 8) ** 2 +
    100 * Math.max(0, demandaPres - x[2] * 6) ** 2;

  const constraint = (x: number[]) => x[0] >= 1 && x[1] >= 1 && x[2] >= 1;
  const result = gradientDescent(f, [params.web, params.telefono, params.presencial], { lr: 0.001, bounds: [[1, 20], [1, 20], [1, 20]], constraints: constraint, maxIter: 1500 });

  const costoOpt = f(result.x);
  return {
    variables: { operadores_web: Math.round(result.x[0]), operadores_telefono: Math.round(result.x[1]), operadores_presencial: Math.round(result.x[2]) },
    costo_inicial: Math.round(costoInicial * 100) / 100,
    costo_optimizado: Math.round(costoOpt * 100) / 100,
    ahorro: Math.round((costoInicial - costoOpt) * 100) / 100,
    converge: result.converge, iteraciones: result.iter, metodo: 'gradiente-descendente',
  };
}

export function optimizarTiempos(params: { tiempos: Record<string, number>; minimo: number; maximo: number }): OptimResult {
  const { tiempos, minimo = 5, maximo = 60 } = params;
  const entries = Object.entries(tiempos);
  if (entries.length === 0) return { variables: {}, costo_inicial: 0, costo_optimizado: 0, ahorro: 0, converge: false, iteraciones: 0, metodo: 'N/A' };

  const avg = entries.reduce((s, [, v]) => s + v, 0) / entries.length;
  const costoInicial = entries.reduce((s, [k, v]) => s + v * 10, 0);

  const f = (x: number[]) => x.reduce((s, v) => s + (v - avg) ** 2, 0);
  const bounds: [number, number][] = entries.map(() => [minimo, maximo]);
  const result = gradientDescent(f, entries.map(([, v]) => v), { lr: 0.005, bounds, maxIter: 1000 });

  const costoOpt = result.x.reduce((s, v) => s + v * 10, 0);
  const variables: Record<string, number> = {};
  entries.forEach(([k], i) => { variables[k] = Math.round(result.x[i] * 10) / 10; });

  return {
    variables, costo_inicial: Math.round(costoInicial * 100) / 100,
    costo_optimizado: Math.round(costoOpt * 100) / 100,
    ahorro: Math.round((costoInicial - costoOpt) * 100) / 100,
    converge: result.converge, iteraciones: result.iter, metodo: 'min-desviacion',
  };
}

export function optimizarCarga(params: { operadores: number; solicitudes: number; maxPorOperador: number }): OptimResult {
  const { operadores, solicitudes, maxPorOperador = 10 } = params;
  if (operadores === 0) return { variables: {}, costo_inicial: solicitudes * 5, costo_optimizado: solicitudes * 5, ahorro: 0, converge: false, iteraciones: 0, metodo: 'N/A' };

  const cargaIdeal = solicitudes / operadores;
  const costoInicial = solicitudes * 5;

  const f = (x: number[]) => {
    const desv = x.reduce((s, v) => s + (v - cargaIdeal) ** 2, 0) / x.length;
    const penalizacion = x.reduce((s, v) => s + Math.max(0, v - maxPorOperador) ** 2 * 100, 0);
    return desv + penalizacion;
  };

  const bounds: [number, number][] = Array(operadores).fill([0, maxPorOperador]);
  const x0 = Array(operadores).fill(cargaIdeal);
  const result = gradientDescent(f, x0, { lr: 0.01, bounds, maxIter: 1000 });

  const variables: Record<string, number> = {};
  result.x.forEach((v, i) => { variables[`operador_${i + 1}`] = Math.round(v * 10) / 10; });
  const costoOpt = result.x.reduce((s, v) => s + v * 5, 0);

  return {
    variables, costo_inicial: Math.round(costoInicial * 100) / 100,
    costo_optimizado: Math.round(costoOpt * 100) / 100,
    ahorro: Math.round((costoInicial - costoOpt) * 100) / 100,
    converge: result.converge, iteraciones: result.iter, metodo: 'min-desviacion-carga',
  };
}
