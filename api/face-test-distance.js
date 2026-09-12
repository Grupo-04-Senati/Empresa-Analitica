const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

function cosineDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 1;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - Math.max(-1, Math.min(1, similarity));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET' && (!req.url.includes('action=') || req.url.includes('action=list'))) {
    try {
      const { data: rostros, error } = await sb.from('rostros')
        .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha');

      if (error) {
        return res.status(500).json({ error: error.message });
      }

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

  if (req.method === 'GET' && req.url.includes('action=compare')) {
    try {
      const parsedUrl = new nodeUrl.URL(req.url, `http://${req.headers.host}`);
      const user1Id = parseInt(parsedUrl.searchParams.get('user1'));
      const user2Id = parseInt(parsedUrl.searchParams.get('user2'));

      if (!user1Id || !user2Id) {
        return res.status(400).json({ error: 'Faltan user1 y user2' });
      }

      const { data: rostros, error } = await sb.from('rostros')
        .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha')
        .in('usuario_id', [user1Id, user2Id]);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (!rostros || rostros.length < 2) {
        return res.status(404).json({ error: 'Se necesitan 2 usuarios con rostro registrado' });
      }

      const user1 = rostros.find(r => r.usuario_id === user1Id);
      const user2 = rostros.find(r => r.usuario_id === user2Id);

      if (!user1 || !user2) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const results = {
        user1: { id: user1Id, frontal: user1.embedding_frontal, izquierda: user1.embedding_izquierda, derecha: user1.embedding_derecha },
        user2: { id: user2Id, frontal: user2.embedding_frontal, izquierda: user2.embedding_izquierda, derecha: user2.embedding_derecha },
        distances: {},
      };

      const angles = ['frontal', 'izquierda', 'derecha'];
      const distances = {};

      for (const angle1 of angles) {
        for (const angle2 of angles) {
          const emb1 = user1[`embedding_${angle1}`];
          const emb2 = user2[`embedding_${angle2}`];

          if (emb1 && emb2) {
            const key = `${angle1}_vs_${angle2}`;
            const dist = cosineDistance(emb1, emb2);
            distances[key] = Math.round(dist * 10000) / 10000;
          }
        }
      }

      const avgDist = Object.values(distances).reduce((a, b) => a + b, 0) / Object.values(distances).length;

      results.distances = distances;
      results.averageDistance = Math.round(avgDist * 10000) / 10000;
      results.interpretation = avgDist < 0.22 ? 'MUY CERCA (mismo umbral que login)' :
                               avgDist < 0.4 ? 'CERCA (podria causar confusion)' :
                               avgDist < 0.6 ? 'MEDIA (distincion razonable)' : 'LEJANA (buena distincion)';

      return res.status(200).json(results);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST' && req.url.includes('action=test-vectors')) {
    try {
      const body = await new Promise((resolve, reject) => {
        let bodyStr = '';
        req.on('data', chunk => { bodyStr += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(bodyStr)); } catch { resolve({}); }
        });
        req.on('error', reject);
      });

      const { vector_a, vector_b } = body;

      if (!vector_a || !vector_b) {
        return res.status(400).json({ error: 'Faltan vector_a y vector_b' });
      }

      if (vector_a.length !== 128 || vector_b.length !== 128) {
        return res.status(400).json({ error: 'Los vectores deben ser de 128 dimensiones' });
      }

      const distance = cosineDistance(vector_a, vector_b);

      return res.status(200).json({
        distance: Math.round(distance * 10000) / 10000,
        threshold_022: distance < 0.22,
        threshold_015: distance < 0.15,
        interpretation: distance < 0.15 ? 'MISMO USUARIO (umbral estricto)' :
                        distance < 0.22 ? 'MISMO USUARIO (umbral normal)' :
                        distance < 0.4 ? 'POSIBLE CONFUSION' :
                        distance < 0.6 ? 'DIFERENTES (distancia media)' : 'DIFERENTES (distancia lejana)',
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(200).json({
    endpoints: {
      'GET /api/face-test-distance?action=list': 'Lista usuarios con rostro registrado',
      'GET /api/face-test-distance?action=compare&user1=X&user2=Y': 'Compara distancias entre 2 usuarios',
      'POST /api/face-test-distance?action=test-vectors': 'Prueba distancia entre 2 vectores personalizados (body: {vector_a: [...], vector_b: [...]})',
    },
  });
};
