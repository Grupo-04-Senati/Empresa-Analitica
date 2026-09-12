const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

const UMBRAL_SIMILITUD = 0.6;
const UMBRAL_DISTANCIA = 0.4;
const UMBRAL_GAP = 0.05;

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

function cosineDistance(a, b) {
  return 1 - cosineSimilarity(a, b);
}

function l2Normalize(arr) {
  let norm = 0;
  for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < arr.length; i++) arr[i] /= norm;
  }
  return arr;
}

function parseEmbedding(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

const SHAPE_SIMILARITY = {
  ovalado:    ['ovalado', 'alargado', 'corazon'],
  redondo:    ['redondo', 'cuadrado'],
  cuadrado:   ['cuadrado', 'redondo', 'triangular'],
  alargado:   ['alargado', 'ovalado'],
  corazon:    ['corazon', 'ovalado', 'diamante'],
  diamante:   ['diamante', 'corazon'],
  triangular: ['triangular', 'cuadrado'],
};

function isShapeCompatible(detected, registered) {
  if (!detected || !registered) return true;
  if (detected === registered) return true;
  const allowed = SHAPE_SIMILARITY[registered] || [registered];
  return allowed.includes(detected);
}

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

      const normalizeEmbedding = (emb) => {
        if (!emb || !Array.isArray(emb) || emb.length !== 128) return null;
        const hasNaN = emb.some(v => isNaN(v));
        if (hasNaN) return null;
        return l2Normalize([...emb]);
      };

      const frontalNorm = normalizeEmbedding(embeddings.frontal);
      const izqNorm = normalizeEmbedding(embeddings.izquierda);
      const derNorm = normalizeEmbedding(embeddings.derecha);

      if (!frontalNorm || !izqNorm || !derNorm) {
        return res.status(422).json({ error: 'Embeddings invalidos o con NaN' });
      }

      const updateData = {
        embedding_frontal: `[${frontalNorm.join(',')}]`,
        embedding_izquierda: `[${izqNorm.join(',')}]`,
        embedding_derecha: `[${derNorm.join(',')}]`,
        forma_rostro: face_shape || null,
        proporciones: proporciones || null,
        landmarks_68: landmarks_68 || null,
      };

      const existing = await sb.from('rostros').select('id').eq('usuario_id', usuario_id);

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
      const { embeddings, face_shape } = body;

      if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
        console.error('[audit] LOGIN REJECTED: no embeddings provided');
        return res.status(400).json({ error: 'Faltan embeddings' });
      }

      if (embeddings.length < 3) {
        console.error(`[audit] LOGIN REJECTED: only ${embeddings.length} embeddings, need 3`);
        return res.status(400).json({ error: `Se necesitan 3 embeddings, solo se recibieron ${embeddings.length}` });
      }

      const normalizedEmbs = embeddings.map(e => {
        if (!e || !Array.isArray(e) || e.length !== 128) return null;
        const hasNaN = e.some(v => isNaN(v));
        if (hasNaN) return null;
        return l2Normalize([...e]);
      }).filter(e => e !== null);

      if (normalizedEmbs.length < 3) {
        console.error('[audit] LOGIN REJECTED: less than 3 valid embeddings after normalization');
        return res.status(400).json({ error: 'Embeddings invalidos' });
      }

      const { data: rostros, error: fetchErr } = await sb.from('rostros')
        .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha, forma_rostro');

      if (fetchErr) {
        console.error('[face] fetch error:', fetchErr.message);
        return res.status(500).json({ error: 'Error consultando BD' });
      }

      if (!rostros || rostros.length === 0) {
        return res.status(401).json({
          error: 'No hay rostros registrados',
          _debug: { embeddingsReceived: embeddings.length, storedUsers: 0 }
        });
      }

      const userScores = {};

      for (const row of rostros) {
        const uid = row.usuario_id;
        const storedFrontal = parseEmbedding(row.embedding_frontal);
        const storedIzq = parseEmbedding(row.embedding_izquierda);
        const storedDer = parseEmbedding(row.embedding_derecha);

        if (!storedFrontal || !storedIzq || !storedDer) continue;

        const storedEmbs = [storedFrontal, storedIzq, storedDer];
        const allScores = [];

        for (const loginEmb of normalizedEmbs) {
          let bestScore = -1;
          for (const storedEmb of storedEmbs) {
            const score = cosineSimilarity(loginEmb, storedEmb);
            if (score > bestScore) bestScore = score;
          }
          allScores.push(bestScore);
        }

        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const matchCount = allScores.filter(s => s >= UMBRAL_SIMILITUD).length;

        if (matchCount >= 2) {
          if (!userScores[uid]) userScores[uid] = { scores: [], matchCount: 0 };
          userScores[uid].scores.push(avgScore);
          userScores[uid].matchCount += matchCount;
        }
      }

      const candidatos = Object.entries(userScores)
        .map(([uid, data]) => ({
          userId: Number(uid),
          avgSimilarity: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
          matchCount: data.matchCount,
        }))
        .filter(c => c.matchCount >= 2)
        .sort((a, b) => b.matchCount - a.matchCount || b.avgSimilarity - a.avgSimilarity);

      console.log('[face] login candidates:', JSON.stringify(candidatos));

      if (candidatos.length === 0) {
        return res.status(401).json({
          error: 'Rostro no reconocido',
          _debug: {
            embeddingsReceived: embeddings.length,
            normalizedEmbs: normalizedEmbs.length,
            storedUsers: rostros.length,
            threshold: UMBRAL_SIMILITUD,
          }
        });
      }

      const winner = candidatos[0];
      const winnerDist = 1 - winner.avgSimilarity;

      const { data: rostroData } = await sb.from('rostros')
        .select('forma_rostro')
        .eq('usuario_id', winner.userId)
        .limit(1);

      const registeredShape = rostroData?.[0]?.forma_rostro || null;

      if (registeredShape && face_shape && !isShapeCompatible(face_shape, registeredShape)) {
        console.error(`[audit] LOGIN REJECTED: face shape mismatch - detected=${face_shape}, registered=${registeredShape}`);
        return res.status(401).json({
          error: 'Forma facial no coincide',
          _debug: { detectedShape: face_shape, registeredShape }
        });
      }

      const { data: usuario } = await sb.from('usuarios')
        .select('id, nombre, email, rol')
        .eq('id', winner.userId)
        .limit(1);

      if (!usuario || usuario.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      console.log(`[audit] LOGIN OK: user ${winner.userId}, similarity=${winner.avgSimilarity.toFixed(4)}, matchCount=${winner.matchCount}`);

      return res.status(200).json({
        ok: true,
        usuario_id: usuario[0].id,
        nombre: usuario[0].nombre,
        email: usuario[0].email,
        distancia: Math.round(winnerDist * 10000) / 10000,
        similitud: Math.round(winner.avgSimilarity * 10000) / 10000,
        _debug: {
          embeddingsReceived: embeddings.length,
          normalizedEmbs: normalizedEmbs.length,
          matchCount: winner.matchCount,
          avgSimilarity: winner.avgSimilarity,
          avgDistance: winnerDist,
          threshold: UMBRAL_SIMILITUD,
          userId: winner.userId,
          detectedShape: face_shape,
          registeredShape,
        }
      });
    } catch (e) {
      console.error('[audit] LOGIN ERROR (exception):', e.message, e.stack);
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

      const distances = {};
      for (const a1 of ['frontal', 'izquierda', 'derecha']) {
        for (const a2 of ['frontal', 'izquierda', 'derecha']) {
          const e1 = parseEmbedding(user1[`embedding_${a1}`]);
          const e2 = parseEmbedding(user2[`embedding_${a2}`]);
          if (e1 && e2) distances[`${a1}_vs_${a2}`] = Math.round(cosineDistance(e1, e2) * 10000) / 10000;
        }
      }
      const vals = Object.values(distances);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

      return res.status(200).json({
        user1: user1Id, user2: user2Id,
        distances,
        averageDistance: Math.round(avg * 10000) / 10000,
        averageSimilarity: Math.round((1 - avg) * 10000) / 10000,
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
      const normA = l2Normalize([...vector_a]);
      const normB = l2Normalize([...vector_b]);
      const dist = cosineDistance(normA, normB);
      const sim = 1 - dist;
      return res.status(200).json({
        distance: Math.round(dist * 10000) / 10000,
        similarity: Math.round(sim * 10000) / 10000,
        threshold_06: sim >= 0.6,
        interpretation: sim >= 0.6 ? 'MISMO USUARIO (similitud >= 0.6)' :
                       sim >= 0.4 ? 'PODER CONFLICTO (similitud entre 0.4-0.6)' :
                       'DIFERENTES PERSONAS (similitud < 0.4)',
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: 'Accion no encontrada' });
};
