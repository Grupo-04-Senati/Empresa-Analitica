const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

const UMBRAL = 0.35;
const UMBRAL_GAP = 0.15;
const MIN_MATCHES = 3;

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
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return 1 - Math.max(-1, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
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
      console.log('[face] login body:', JSON.stringify({ hasEmbeddings: !!body.embeddings, count: body.embeddings?.length }));

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
        const storedEmbeds = [];
        if (r.embedding_frontal) storedEmbeds.push(r.embedding_frontal);
        if (r.embedding_izquierda) storedEmbeds.push(r.embedding_izquierda);
        if (r.embedding_derecha) storedEmbeds.push(r.embedding_derecha);

        if (storedEmbeds.length < 2) continue;

        let totalBestDist = 0;
        let matchCount = 0;

        for (const loginEmb of embeddings) {
          let bestDistForThisLogin = Infinity;
          for (const stored of storedEmbeds) {
            const dist = cosineDistance(loginEmb, stored);
            if (dist < bestDistForThisLogin) bestDistForThisLogin = dist;
          }
          if (bestDistForThisLogin <= UMBRAL) {
            totalBestDist += bestDistForThisLogin;
            matchCount++;
          }
        }

        console.log(`[face] user ${uid}: matchCount=${matchCount}, totalBestDist=${totalBestDist.toFixed(4)}, storedEmbeds=${storedEmbeds.length}`);

        if (matchCount >= MIN_MATCHES) {
          const avgDist = totalBestDist / matchCount;
          userResults.push({ userId: uid, avgDist, matchCount });
        }
      }

      if (userResults.length === 0) {
        return res.status(401).json({ error: 'Rostro no reconocido' });
      }

      userResults.sort((a, b) => a.avgDist - b.avgDist);

      if (userResults.length > 1 && (userResults[1].avgDist - userResults[0].avgDist) < UMBRAL_GAP) {
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
      });
    } catch (e) {
      console.error('[face] login error:', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  return res.status(404).json({ error: 'Accion no encontrada' });
};
