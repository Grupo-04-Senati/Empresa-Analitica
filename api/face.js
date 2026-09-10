const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

const UMBRAL = 0.20;
const UMBRAL_GAP = 0.10;
const MIN_MATCHES = 2;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { resolve(JSON.parse(req.body)); } catch { resolve({}); }
      } else {
        resolve(req.body);
      }
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function cosineDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 1;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 1;
  return 1 - Math.max(-1, Math.min(1, dot / denom));
}

function parseVector(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v.replace(/^\[/, '[').replace(/\]$/, ']')); } catch { return null; }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const parsedUrl = new nodeUrl.URL(req.url, `http://${req.headers.host}`);
  const action = parsedUrl.searchParams.get('action');

  if (req.method === 'GET' && action === 'health') {
    return res.status(200).json({ status: 'ok' });
  }

  if (req.method === 'GET' && action === 'check-registered') {
    const { data } = await sb.from('rostros').select('id').limit(1);
    return res.status(200).json({ count: (data || []).length });
  }

  if (req.method === 'POST' && action === 'register') {
    try {
      const body = await parseBody(req);
      console.log('[face] register body:', JSON.stringify({ usuario_id: body.usuario_id, hasEmbeddings: !!body.embeddings }));

      const { usuario_id, embeddings } = body;
      if (!usuario_id || !embeddings) {
        return res.status(400).json({ error: 'Faltan datos' });
      }

      const validCount = Object.values(embeddings).filter(e => e !== null).length;
      if (validCount < 2) {
        return res.status(422).json({ error: 'Se necesitan al menos 2 embeddings validos' });
      }

      const existing = await sb.from('rostros').select('id').eq('usuario_id', usuario_id);
      const updateData = {
        embedding_frontal: embeddings.frontal || null,
        embedding_izquierda: embeddings.izquierda || null,
        embedding_derecha: embeddings.derecha || null,
      };

      if (existing.data && existing.data.length > 0) {
        await sb.from('rostros').update(updateData).eq('usuario_id', usuario_id);
      } else {
        await sb.from('rostros').insert({ usuario_id, ...updateData });
      }

      return res.status(200).json({ ok: true, valid_angles: validCount });
    } catch (e) {
      console.error('[face] register error:', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  if (req.method === 'POST' && action === 'login') {
    try {
      const body = await parseBody(req);
      console.log(`[face] login body:`, JSON.stringify({ hasEmbeddings: !!body.embeddings, count: body.embeddings?.length }));

      const { embeddings } = body;
      if (!embeddings || embeddings.length === 0) {
        return res.status(400).json({ error: 'Faltan embeddings' });
      }

      const { data: rostros } = await sb.from('rostros').select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha');
      if (!rostros || rostros.length === 0) {
        return res.status(404).json({ error: 'No hay usuarios registrados' });
      }

      const userResults = [];

      for (const r of rostros) {
        const uid = r.usuario_id;
        const storedFrontal = parseVector(r.embedding_frontal);
        const storedIzq = parseVector(r.embedding_izquierda);
        const storedDer = parseVector(r.embedding_derecha);

        const allStored = [storedFrontal, storedIzq, storedDer].filter(Boolean);
        if (allStored.length < 2) {
          console.log(`[face] user ${uid}: skipped (only ${allStored.length} stored embeddings)`);
          continue;
        }

        const allDists = [];
        for (const loginEmb of embeddings) {
          for (const stored of allStored) {
            allDists.push(cosineDistance(loginEmb, stored));
          }
        }

        allDists.sort((a, b) => a - b);
        const topK = allDists.slice(0, Math.min(3, allDists.length));
        const avgTopK = topK.reduce((a, b) => a + b, 0) / topK.length;

        const closeMatches = allDists.filter(d => d <= UMBRAL);

        console.log(`[face] user ${uid}: avgTopK=${avgTopK.toFixed(4)}, closeMatches=${closeMatches.length}/${allDists.length}, topDists=[${topK.map(d => d.toFixed(4)).join(', ')}]`);

        if (closeMatches.length >= MIN_MATCHES && avgTopK <= UMBRAL) {
          userResults.push({ userId: uid, avgDist: avgTopK, matchCount: closeMatches.length });
        }
      }

      if (userResults.length === 0) {
        const debugInfo = userResults.length > 0
          ? userResults.map(u => `user ${u.userId}: dist=${u.avgDist.toFixed(4)}`).join('; ')
          : 'no users matched';
        console.log(`[face] login REJECTED: ${debugInfo}`);
        return res.status(401).json({ error: 'Rostro no reconocido' });
      }

      userResults.sort((a, b) => a.avgDist - b.avgDist);

      const gap = userResults.length > 1 ? (userResults[1].avgDist - userResults[0].avgDist) : 999;
      console.log(`[face] winner: user ${userResults[0].userId} (${userResults[0].avgDist.toFixed(4)}), gap=${gap.toFixed(4)}`);

      if (userResults.length > 1 && gap < UMBRAL_GAP) {
        return res.status(401).json({ error: 'Rostro ambiguo, intente de nuevo' });
      }

      const winner = userResults[0];
      const { data: usuario } = await sb.from('usuarios').select('id, nombre, email, rol').eq('id', winner.userId).limit(1);

      if (!usuario || usuario.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json({
        ok: true,
        usuario_id: usuario[0].id,
        nombre: usuario[0].nombre,
        email: usuario[0].email,
        distancia: Math.round(winner.avgDist * 10000) / 10000,
        _debug: {
          umbral: UMBRAL,
          avgDist: winner.avgDist,
          matchCount: winner.matchCount,
          gap,
        },
      });
    } catch (e) {
      console.error('[face] login error:', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  return res.status(404).json({ error: 'Accion no encontrada' });
};
