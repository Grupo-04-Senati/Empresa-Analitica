import { supabase } from './supabase';

export interface StatsResult {
  cantidad: number;
  media: number;
  mediana: number;
  desviacion_estandar: number;
  minimo: number;
  maximo: number;
  percentil_25: number;
  percentil_75: number;
}

export interface InterpPoint {
  x: number;
  fecha: string;
  observado: number | null;
  interpolado: number;
  es_prediccion: boolean;
}

export interface InterpResult {
  puntos: InterpPoint[];
  r2: number;
  error_medio: number;
  error_relativo: number;
  metodo: string;
  puntos_reales: number;
  puntos_estimados: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface FiltrosFecha {
  fecha_inicio?: string;
  fecha_fin?: string;
}

export interface FiltrosCompletos extends FiltrosFecha {
  cliente_id?: number;
  operador?: string;
  canal?: string;
  categoria?: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  return Math.round((sorted[low] + (sorted[high] - sorted[low]) * (idx - low)) * 100) / 100;
}

export function calcStats(valores: number[]): StatsResult | null {
  if (valores.length === 0) return null;
  const sorted = [...valores].sort((a, b) => a - b);
  const cantidad = sorted.length;
  const media = Math.round(sorted.reduce((a, b) => a + b, 0) / cantidad * 100) / 100;
  const mediana = percentile(sorted, 50);
  const varianza = sorted.reduce((sum, v) => sum + (v - media) ** 2, 0) / cantidad;
  const desviacion_estandar = Math.round(Math.sqrt(varianza) * 100) / 100;
  return {
    cantidad, media, mediana, desviacion_estandar,
    minimo: sorted[0], maximo: sorted[cantidad - 1],
    percentil_25: percentile(sorted, 25), percentil_75: percentile(sorted, 75),
  };
}

export function interpolar(xBase: number[], yBase: number[], xNew: number[], metodo: string = 'lineal'): number[] {
  if (xBase.length === 0 || yBase.length === 0) return xNew.map(() => 0);
  if (xBase.length === 1) return xNew.map(() => Math.round(yBase[0] * 100) / 100);

  return xNew.map(x => {
    if (x <= xBase[0]) {
      if (metodo === 'cuadratico' && xBase.length >= 2) {
        const slope = yBase[1] - yBase[0];
        const dx = x - xBase[0];
        return Math.round((yBase[0] + slope * dx) * 100) / 100;
      }
      return Math.round(yBase[0] * 100) / 100;
    }
    if (x >= xBase[xBase.length - 1]) {
      if (metodo === 'cuadratico' && xBase.length >= 3) {
        const n = xBase.length;
        const slope = yBase[n - 1] - yBase[n - 2];
        const dx = x - xBase[n - 1];
        return Math.round((yBase[n - 1] + slope * dx) * 100) / 100;
      }
      return Math.round(yBase[yBase.length - 1] * 100) / 100;
    }

    let i = 0;
    while (i < xBase.length - 1 && xBase[i + 1] < x) i++;
    const t = (x - xBase[i]) / (xBase[i + 1] - xBase[i]);

    if (metodo === 'cuadratico') {
      if (i > 0 && i < xBase.length - 1) {
        const y0 = yBase[i - 1], y1 = yBase[i], y2 = yBase[i + 1];
        const tm1 = t + 1;
        const val = y1 + (y2 - y0) * t * 0.5 + (y0 - 2 * y1 + y2) * t * t * 0.5;
        return Math.round(val * 100) / 100;
      }
      if (i < xBase.length - 2) {
        const t2 = t * t;
        const a = yBase[i];
        const b = yBase[i + 1] - yBase[i];
        const c = (yBase[i + 2] - 2 * yBase[i + 1] + yBase[i]) * 0.5;
        return Math.round((a + b * t + c * t2) * 100) / 100;
      }
      const slope = yBase[i + 1] - yBase[i];
      return Math.round((yBase[i] + slope * t) * 100) / 100;
    }

    return Math.round((yBase[i] + t * (yBase[i + 1] - yBase[i])) * 100) / 100;
  });
}

export async function fetchTiempos(filtros: FiltrosCompletos = {}): Promise<{ fecha: string; tiempo_minutos: number; cliente_id: number | null; operador: string | null }[]> {
  let query = supabase.from('tiempos_atencion').select('tiempo_minutos, fecha, cliente_id, operador');
  if (filtros.fecha_inicio) query = query.gte('fecha', filtros.fecha_inicio);
  if (filtros.fecha_fin) query = query.lte('fecha', filtros.fecha_fin);
  if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
  if (filtros.operador) query = query.eq('operador', filtros.operador);
  query = query.order('fecha', { ascending: true });
  const { data } = await query;
  return (data || []).map(r => ({ fecha: r.fecha?.split('T')[0] || '', tiempo_minutos: Number(r.tiempo_minutos), cliente_id: r.cliente_id, operador: r.operador }));
}

export async function fetchComentarios(filtros: FiltrosCompletos = {}): Promise<any[]> {
  let query = supabase.from('comentarios').select('id, contenido, categoria, canal, estado, fecha, procesado, cliente_id, clientes(nombre, empresa)');
  if (filtros.fecha_inicio) query = query.gte('fecha', filtros.fecha_inicio);
  if (filtros.fecha_fin) query = query.lte('fecha', filtros.fecha_fin);
  if (filtros.cliente_id) query = query.eq('cliente_id', filtros.cliente_id);
  if (filtros.canal) query = query.eq('canal', filtros.canal);
  if (filtros.categoria) query = query.eq('categoria', filtros.categoria);
  query = query.order('fecha', { ascending: false });
  const { data } = await query;
  return data || [];
}

export async function fetchAnalisisNLP(filtros: FiltrosCompletos = {}): Promise<any[]> {
  let query = supabase.from('analisis_nlp').select('id, comentario_id, categoria_detectada, confianza, sentimiento, idioma, comentarios(id, contenido, cliente_id, fecha, canal, clientes(nombre, empresa))');
  if (filtros.fecha_inicio) query = query.gte('comentarios.fecha', filtros.fecha_inicio);
  if (filtros.fecha_fin) query = query.lte('comentarios.fecha', filtros.fecha_fin);
  if (filtros.cliente_id) query = query.eq('comentarios.cliente_id', filtros.cliente_id);
  if (filtros.categoria) query = query.eq('categoria_detectada', filtros.categoria);
  query = query.order('id', { ascending: false });
  const { data } = await query;
  return data || [];
}

export async function fetchClientes(): Promise<{ id: number; nombre: string; empresa: string }[]> {
  const { data } = await supabase.from('clientes').select('id, nombre, empresa').eq('activo', true).order('nombre');
  return data || [];
}

export async function fetchOperadores(): Promise<string[]> {
  const { data } = await supabase.from('tiempos_atencion').select('operador').not('operador', 'is', null);
  const ops = [...new Set((data || []).map(r => r.operador).filter(Boolean))];
  return ops.sort();
}

export function calcularInterpolacion(tiempos: { fecha: string; tiempo_minutos: number }[], metodo: string = 'lineal'): InterpResult | null {
  if (tiempos.length < 2) return null;

  const agrupado: Record<string, number[]> = {};
  tiempos.forEach(t => {
    if (!agrupado[t.fecha]) agrupado[t.fecha] = [];
    agrupado[t.fecha].push(t.tiempo_minutos);
  });

  const fechas = Object.keys(agrupado).sort();
  const xBase = fechas.map((_, i) => i + 1);
  const yBase = fechas.map(f => {
    const vals = agrupado[f];
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100;
  });

  const xNew = Array.from({ length: fechas.length + 3 }, (_, i) => i + 1);
  const yInterp = interpolar(xBase, yBase, xNew, metodo);

  const puntos: InterpPoint[] = xNew.map((xi, i) => {
    const idx = xi - 1;
    const esPrediccion = idx >= yBase.length;
    return { x: xi, fecha: esPrediccion ? `Prediccion +${idx - yBase.length + 1}` : fechas[idx], observado: esPrediccion ? null : yBase[idx], interpolado: yInterp[i], es_prediccion: esPrediccion };
  });

  const ssRes = yBase.reduce((sum, _, i) => sum + (yBase[i] - yInterp[i]) ** 2, 0);
  const ssTot = yBase.reduce((sum, v) => sum + (v - yBase.reduce((a, b) => a + b, 0) / yBase.length) ** 2, 0);
  const r2 = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 10000) / 10000 : 0;
  const mae = yBase.reduce((sum, _, i) => sum + Math.abs(yBase[i] - yInterp[i]), 0) / yBase.length;
  const meanObs = yBase.reduce((a, b) => a + b, 0) / yBase.length || 1;

  return {
    puntos, r2, error_medio: Math.round(mae * 100) / 100,
    error_relativo: Math.round((mae / meanObs) * 10000) / 100,
    metodo, puntos_reales: yBase.length,
    puntos_estimados: xNew.length - yBase.length,
    fecha_inicio: fechas[0], fecha_fin: fechas[fechas.length - 1],
  };
}

export function agruparPorDia(tiempos: { fecha: string; tiempo_minutos: number }[]): { fecha: string; promedio: number; cantidad: number; minimo: number; maximo: number }[] {
  const agrupado: Record<string, number[]> = {};
  tiempos.forEach(t => {
    if (!agrupado[t.fecha]) agrupado[t.fecha] = [];
    agrupado[t.fecha].push(t.tiempo_minutos);
  });
  return Object.entries(agrupado).map(([fecha, vals]) => ({
    fecha, promedio: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
    cantidad: vals.length, minimo: Math.min(...vals), maximo: Math.max(...vals),
  })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function agruparPorOperador(tiempos: { operador: string | null; tiempo_minutos: number }[]): { nombre: string; registros: number; promedio: number; minimo: number; maximo: number }[] {
  const agrupado: Record<string, { total: number; suma: number; min: number; max: number }> = {};
  tiempos.forEach(t => {
    const op = t.operador || 'Sin operador';
    if (!agrupado[op]) agrupado[op] = { total: 0, suma: 0, min: Infinity, max: -Infinity };
    agrupado[op].total++;
    agrupado[op].suma += t.tiempo_minutos;
    agrupado[op].min = Math.min(agrupado[op].min, t.tiempo_minutos);
    agrupado[op].max = Math.max(agrupado[op].max, t.tiempo_minutos);
  });
  return Object.entries(agrupado).map(([nombre, v]) => ({
    nombre, registros: v.total,
    promedio: Math.round(v.suma / v.total * 10) / 10,
    minimo: v.min, maximo: v.max,
  })).sort((a, b) => b.registros - a.registros);
}
