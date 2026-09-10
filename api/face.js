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
      const { usuario_id, embeddings, face_shape, proporciones, landmarks_68 } = body;
      if (!usuario_id || !embeddings) {
        return res.status(400).json({ error: 'Faltan datos' });
      }

      console.log('[face] register:', { usuario_id, frontal: !!embeddings.frontal, izquierda: !!embeddings.izquierda, derecha: !!embeddings.derecha, face_shape });

      const validCount = Object.values(embeddings).filter(e => e !== null).length;
      if (validCount < 3) {
        const missing = [];
        if (!embeddings.frontal) missing.push('frontal');
        if (!embeddings.izquierda) missing.push('izquierda');
        if (!embeddings.derecha) missing.push('derecha');
        console.log('[face] register REJECTED: missing', missing);
        return res.status(422).json({
          error: `Faltan embeddings: ${missing.join(', ')}. Captura los 3 ángulos.`,
          missing,
        });
      }

      const existing = await sb.from('rostros').select('id').eq('usuario_id', usuario_id);
      const updateData = {
        embedding_frontal: embeddings.frontal ? `[${embeddings.frontal.join(',')}]` : null,
        embedding_izquierda: embeddings.izquierda ? `[${embeddings.izquierda.join(',')}]` : null,
        embedding_derecha: embeddings.derecha ? `[${embeddings.derecha.join(',')}]` : null,
        forma_rostro: face_shape || null,
        proporciones: proporciones || null,
        landmarks_68: landmarks_68 || null,
      };

      if (existing.data && existing.data.length > 0) {
        const { error: updateErr } = await sb.from('rostros').update(updateData).eq('usuario_id', usuario_id);
        if (updateErr) {
          console.error('[face] register update error:', updateErr);
          return res.status(500).json({ error: 'Error guardando en BD' });
        }
        console.log('[face] register UPDATED for user', usuario_id);
      } else {
        const { error: insertErr } = await sb.from('rostros').insert({ usuario_id, ...updateData });
        if (insertErr) {
          console.error('[face] register insert error:', insertErr);
          return res.status(500).json({ error: 'Error guardando en BD' });
        }
        console.log('[face] register INSERTED for user', usuario_id);
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
      const debugPerEmb = [];

      for (let i = 0; i < embeddings.length; i++) {
        const loginEmb = embeddings[i];
        if (!loginEmb || !Array.isArray(loginEmb)) continue;

        const loginVector = `[${loginEmb.join(',')}]`;

        const { data: resultado, error } = await sb.rpc('buscar_rostro_match', {
          login_embedding: loginVector,
        });

        if (error) {
          console.error(`[face] rpc error emb[${i}]:`, error.message);
          debugPerEmb.push({ idx: i, error: error.message });
          continue;
        }

        if (!resultado || resultado.length === 0) {
          console.log(`[face] emb[${i}]: sin resultado`);
          debugPerEmb.push({ idx: i, result: 'empty' });
          continue;
        }

        const r = resultado[0];
        console.log(`[face] emb[${i}]: user=${r.usuario_id}, dist=${r.dist_promedio?.toFixed(4)}, es_match=${r.es_match}, frontal=${r.dist_frontal?.toFixed(4)}, izq=${r.dist_izquierda?.toFixed(4)}, der=${r.dist_derecha?.toFixed(4)}`);

        debugPerEmb.push({
          idx: i,
          userId: r.usuario_id,
          dist: r.dist_promedio,
          esMatch: r.es_match,
          frontal: r.dist_frontal,
          izq: r.dist_izquierda,
          der: r.dist_derecha,
        });

        if (r.es_match) {
          const uid = r.usuario_id;
          matchCounts[uid] = (matchCounts[uid] || 0) + 1;
          if (!matchDists[uid]) matchDists[uid] = [];
          matchDists[uid].push(r.dist_promedio);
        }
      }

      console.log('[face] matchCounts:', JSON.stringify(matchCounts));
      console.log('[face] debug per embedding:', JSON.stringify(debugPerEmb));

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
        return res.status(401).json({
          error: 'Rostro no reconocido',
          _debug: {
            embeddingsReceived: embeddings.length,
            perEmbedding: debugPerEmb,
            matchCounts,
            umbral: 0.35,
            message: 'Ningun embedding paso el umbral de 0.35'
          }
        });
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
        _debug: {
          embeddingsReceived: embeddings.length,
          perEmbedding: debugPerEmb,
          matchCounts,
          umbral: 0.35,
        }
      });
    } catch (e) {
      console.error('[face] login error:', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  if (req.method === 'GET' && action === 'test-distance-list') {
    try {
      const { data: rostros, error } = await sb.from('rostros')
        .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha');
      if (error) return res.status(500).json({ error: error.message });
      if (!rostros || rostros.length === 0) {
        return res.status(200).json({ users: 0, message: 'No hay usuarios con rostro registrado' });
      }
      const users = rostros.map(r => ({
        usuario_id: r.usuario_id,
        hasFrontal: !!r.embedding_frontal,
        hasIzquierda: !!r.embedding_izquierda,
        hasDerecha: !!r.embedding_derecha,
      }));
      return res.status(200).json({ users: users.length, data: users });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'GET' && action === 'test-distance-compare') {
    try {
      const user1Id = parseInt(parsedUrl.searchParams.get('user1'));
      const user2Id = parseInt(parsedUrl.searchParams.get('user2'));
      if (!user1Id || !user2Id) {
        return res.status(400).json({ error: 'Faltan user1 y user2' });
      }
      const { data: rostros, error } = await sb.from('rostros')
        .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha')
        .in('usuario_id', [user1Id, user2Id]);
      if (error) return res.status(500).json({ error: error.message });
      if (!rostros || rostros.length < 2) {
        return res.status(404).json({ error: 'Se necesitan 2 usuarios con rostro registrado' });
      }
      const user1 = rostros.find(r => r.usuario_id === user1Id);
      const user2 = rostros.find(r => r.usuario_id === user2Id);
      if (!user1 || !user2) return res.status(404).json({ error: 'Usuario no encontrado' });

      function cosDist(a, b) {
        if (!a || !b || a.length !== b.length) return 1;
        let dot = 0, nA = 0, nB = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
        return 1 - Math.max(-1, Math.min(1, dot / (Math.sqrt(nA) * Math.sqrt(nB))));
      }

      const distances = {};
      for (const a1 of ['frontal', 'izquierda', 'derecha']) {
        for (const a2 of ['frontal', 'izquierda', 'derecha']) {
          const e1 = user1[`embedding_${a1}`];
          const e2 = user2[`embedding_${a2}`];
          if (e1 && e2) distances[`${a1}_vs_${a2}`] = Math.round(cosDist(e1, e2) * 10000) / 10000;
        }
      }
      const vals = Object.values(distances);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

      return res.status(200).json({
        user1: user1Id, user2: user2Id,
        distances,
        averageDistance: Math.round(avg * 10000) / 10000,
        interpretation: avg < 0.22 ? 'MUY CERCA (mismo umbral que login)' :
                       avg < 0.4 ? 'CERCA (podria causar confusion)' :
                       avg < 0.6 ? 'MEDIA (distincion razonable)' : 'LEJANA (buena distincion)',
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST' && action === 'test-distance-vectors') {
    try {
      const body = await parseBody(req);
      const { vector_a, vector_b } = body;
      if (!vector_a || !vector_b) return res.status(400).json({ error: 'Faltan vector_a y vector_b' });
      if (vector_a.length !== 128 || vector_b.length !== 128) {
        return res.status(400).json({ error: 'Los vectores deben ser de 128 dimensiones' });
      }
      let dot = 0, nA = 0, nB = 0;
      for (let i = 0; i < 128; i++) { dot += vector_a[i] * vector_b[i]; nA += vector_a[i] ** 2; nB += vector_b[i] ** 2; }
      const dist = 1 - Math.max(-1, Math.min(1, dot / (Math.sqrt(nA) * Math.sqrt(nB))));
      return res.status(200).json({
        distance: Math.round(dist * 10000) / 10000,
        threshold_022: dist < 0.22,
        threshold_015: dist < 0.15,
        interpretation: dist < 0.15 ? 'MISMO USUARIO (umbral estricto)' :
                        dist < 0.22 ? 'MISMO USUARIO (umbral normal)' :
                        dist < 0.4 ? 'POSIBLE CONFUSION' :
                        dist < 0.6 ? 'DIFERENTES (distancia media)' : 'DIFERENTES (distancia lejana)',
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: 'Accion no encontrada' });
};
