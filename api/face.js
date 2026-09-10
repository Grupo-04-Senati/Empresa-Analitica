const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

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
        embedding_frontal: embeddings.frontal ? `[${embeddings.frontal.join(',')}]` : null,
        embedding_izquierda: embeddings.izquierda ? `[${embeddings.izquierda.join(',')}]` : null,
        embedding_derecha: embeddings.derecha ? `[${embeddings.derecha.join(',')}]` : null,
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
      const { embeddings } = body;

      if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
        return res.status(400).json({ error: 'Faltan embeddings' });
      }

      const matchCounts = {};
      const matchDists = {};

      for (const loginEmb of embeddings) {
        if (!loginEmb || !Array.isArray(loginEmb)) continue;

        const loginVector = `[${loginEmb.join(',')}]`;

        const { data: resultado, error } = await sb.rpc('buscar_rostro_match', {
          login_embedding: loginVector,
        });

        if (error) {
          console.error('[face] rpc error:', error.message);
          continue;
        }

        if (!resultado || resultado.length === 0) continue;

        const r = resultado[0];
        if (r.es_match) {
          const uid = r.usuario_id;
          matchCounts[uid] = (matchCounts[uid] || 0) + 1;
          if (!matchDists[uid]) matchDists[uid] = [];
          matchDists[uid].push(r.dist_promedio);
        }
      }

      const candidatos = Object.entries(matchCounts)
        .map(([uid, count]) => ({
          userId: Number(uid),
          matchCount: count,
          avgDist: matchDists[uid].reduce((a, b) => a + b, 0) / matchDists[uid].length,
        }))
        .filter(c => c.matchCount >= 2)
        .sort((a, b) => b.matchCount - a.matchCount || a.avgDist - b.avgDist);

      console.log('[face] login candidates:', JSON.stringify(candidatos));

      if (candidatos.length === 0) {
        return res.status(401).json({ error: 'Rostro no reconocido' });
      }

      const winner = candidatos[0];

      const { data: usuario } = await sb.from('usuarios')
        .select('id, nombre, email, rol')
        .eq('id', winner.userId)
        .limit(1);

      if (!usuario || usuario.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      console.log(`[face] login OK: user ${winner.userId}, matches=${winner.matchCount}, avgDist=${winner.avgDist.toFixed(4)}`);

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
