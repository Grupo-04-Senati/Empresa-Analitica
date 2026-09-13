const API_URL = import.meta.env.VITE_API_URL || 'https://empresa-analitica.onrender.com';

interface BackendAnalisis {
  idioma: string;
  cantidad_palabras: number;
  tokens: string[];
  keywords: string[];
  temas: string[];
  palabras_frecuentes: { palabra: string; frecuencia: number }[];
  categoria: string;
  categoria_detectada: string;
  sentimiento: 'positivo' | 'negativo' | 'neutro';
  confianza: number;
}

export async function analizarConBackend(texto: string): Promise<BackendAnalisis | null> {
  try {
    const res = await fetch(`${API_URL}/api/nltk/analizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function analizarLocal(texto: string): BackendAnalisis {
  const positivas = ['excelente','bueno','buen','buenas','genial','increible','perfecto','agradecido','gracias','feliz','satisfecho','recomiendo','me gusta','maravilloso','fantastico','rapido','eficiente','calidad','profesional','amable','resolvio','ayuda','mejor','bien','ok'];
  const negativas = ['malo','mala','terrible','pesimo','horrible','lento','lenta','error','problema','queja','reclamo','insatisfecho','decepcionado','no funciona','no sirve','muy lento','deficiente','lamentable','estafa','fraude','furioso','molesto','carajo','mierda','puta','basura','asco','desastre','falso','robo','corrupto','inutil','verguenza','odio'];
  const ventasKw = ['factura','facturacion','precio','precios','costo','comprar','compra','plan','planes','contrato','pagar','pago','descuento','tarifa','cotizacion','presupuesto'];
  const soporteKw = ['sistema','contrasena','acceso','login','soporte','tecnico','bug','plataforma','app','cuenta','conexion','ayuda','no puedo','no me funciona'];
  const reclamoKw = ['queja','reclamo','cancelar','cancelacion','molesto','inaceptable','desastre','horrible','decepcion','estafa','perjuicio'];
  const felicKw = ['gracias','excelente','felicitaciones','felicidades','felicito','satisfecho','genial','perfecto','recomiendo','agradecido'];

  const t = texto.toLowerCase();
  const tokens = t.split(/\s+/).filter(w => w.length > 2);
  let posCount = 0, negCount = 0;
  positivas.forEach(p => { if (t.includes(p)) posCount++; });
  negativas.forEach(n => { if (t.includes(n)) negCount++; });

  const scores: Record<string, number> = { FELICITACION: 0, RECLAMO: 0, SOPORTE: 0, VENTAS: 0 };
  tokens.forEach(tok => {
    if (felicKw.some(k => tok.includes(k))) scores.FELICITACION += 2;
    if (reclamoKw.some(k => tok.includes(k))) scores.RECLAMO += 2;
    if (soporteKw.some(k => tok.includes(k))) scores.SOPORTE += 2;
    if (ventasKw.some(k => tok.includes(k))) scores.VENTAS += 2;
  });

  if (t.includes('muchas gracias') || t.includes('muy bueno') || t.includes('excelente atencion') || t.includes('buen servicio') || t.includes('me encanta')) scores.FELICITACION += 5;
  if (t.includes('no funciona') || t.includes('muy lento') || t.includes('pesimo servicio') || t.includes('mala atencion') || t.includes('no sirve')) scores.RECLAMO += 5;
  if (t.includes('no puedo ingresar') || t.includes('olvide mi clave') || t.includes('error en el sistema') || t.includes('soporte tecnico')) scores.SOPORTE += 5;
  if (t.includes('cuanto cuesta') || t.includes('informacion de precios') || t.includes('planes disponibles') || t.includes('quiero comprar') || t.includes('generar factura')) scores.VENTAS += 5;

  const maxScore = Math.max(...Object.values(scores));
  let categoria = 'CONSULTA';
  let confianza = 60.0;
  if (maxScore > 0) {
    categoria = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    confianza = Math.min(98, 75 + maxScore * 5);
  }

  let sentimiento: 'positivo' | 'negativo' | 'neutro' = 'neutro';
  if (categoria === 'FELICITACION' || posCount > negCount) sentimiento = 'positivo';
  else if (categoria === 'RECLAMO' || negCount > posCount) sentimiento = 'negativo';

  const negPenalty = Math.min(35, negCount * 12);
  const mixedPenalty = (posCount > 0 && negCount > 0) ? Math.min(20, Math.abs(posCount - negCount) * 5) : 0;
  const totalPenalty = negPenalty + mixedPenalty;
  confianza = Math.max(15, confianza - totalPenalty);

  if (sentimiento === 'negativo') {
    confianza = Math.min(confianza, 70);
  }

  const freq: Record<string, number> = {};
  tokens.forEach(t => { if (t.length > 2) freq[t] = (freq[t] || 0) + 1; });
  const palabras_frecuentes = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([palabra, frecuencia]) => ({ palabra, frecuencia }));

  return {
    idioma: 'es',
    cantidad_palabras: tokens.length,
    tokens,
    keywords: Object.keys(freq).slice(0, 6),
    temas: [categoria],
    palabras_frecuentes,
    categoria,
    categoria_detectada: categoria,
    sentimiento,
    confianza: Math.round(confianza * 10) / 10,
  };
}

export async function analizar(texto: string): Promise<BackendAnalisis> {
  const backend = await analizarConBackend(texto);
  if (backend) return backend;
  return analizarLocal(texto);
}
