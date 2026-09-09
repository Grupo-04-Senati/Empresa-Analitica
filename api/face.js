const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

const UMBRAL = 0.35;
const UMBRAL_GAP = 0.08;
const MIN_MATCHES = 2;

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
      const { usuario_id, embeddings } = req.body;
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
      const { embeddings } = req.body;
      if (!embeddings || embeddings.length === 0) {
        return res.status(400).json({ error: 'Faltan embeddings' });
      }

      const { data: rostros } = await sb.from('rostros').select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha');
      if (!rostros || rostros.length === 0) {
        return res.status(404).json({ error: 'No hay usuarios registrados' });
      }

      const userScores = {};

      for (const loginEmb of embeddings) {
        for (const r of rostros) {
          const uid = r.usuario_id;
          for (const key of ['embedding_frontal', 'embedding_izquierda', 'embedding_derecha']) {
            const stored = r[key];
            if (!stored) continue;
            const dist = cosineDistance(loginEmb, stored);
            if (!userScores[uid]) userScores[uid] = [];
            userScores[uid].push(dist);
          }
        }
      }

      const results = [];
      for (const [uid, dists] of Object.entries(userScores)) {
        const matches = dists.filter(d => d <= UMBRAL);
        if (matches.length >= MIN_MATCHES) {
          results.push({ userId: Number(uid), bestDist: Math.min(...matches), matchCount: matches.length });
        }
      }

      if (results.length === 0) {
        return res.status(401).json({ error: 'Rostro no reconocido' });
      }

      results.sort((a, b) => a.bestDist - b.bestDist);

      if (results.length > 1 && (results[1].bestDist - results[0].bestDist) < UMBRAL_GAP) {
        return res.status(401).json({ error: 'Rostro ambiguo, intente de nuevo' });
      }

      const winner = results[0];
      const { data: usuario } = await sb.from('usuarios').select('id, nombre, email, rol').eq('id', winner.userId).limit(1);

      if (!usuario || usuario.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json({
        ok: true,
        usuario_id: usuario[0].id,
        nombre: usuario[0].nombre,
        email: usuario[0].email,
        distancia: Math.round(winner.bestDist * 10000) / 10000,
      });
    } catch (e) {
      console.error('[face] login error:', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  return res.status(404).json({ error: 'Accion no encontrada' });
};
