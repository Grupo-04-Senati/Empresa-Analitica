const { createClient } = require('@supabase/supabase-js');
const nodeUrl = require('url');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY);

const UMBRAL = 0.22;
const MARGEN = 0.05;

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

function vectorToSql(arr) {
  if (!arr || !Array.isArray(arr)) return null;
  return `[${arr.join(',')}]`;
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
        embedding_frontal: vectorToSql(embeddings.frontal),
        embedding_izquierda: vectorToSql(embeddings.izquierda),
        embedding_derecha: vectorToSql(embeddings.derecha),
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

      let mejorUsuario = null;
      let mejorDist = 999;
      let segundoDist = 999;

      for (const loginEmb of embeddings) {
        const loginVector = vectorToSql(loginEmb);
        if (!loginVector) continue;

        const { data: candidatos, error } = await sb.rpc('buscar_rostro_match', {
          login_embedding: loginVector,
          p_umbral: UMBRAL,
          p_margen: MARGEN,
        });

        if (error) {
          console.error('[face] rpc error:', error);
          continue;
        }

        if (!candidatos || candidatos.length === 0) continue;

        for (const c of candidatos) {
          if (c.es_match) {
            if (c.dist_promedio < mejorDist) {
              segundoDist = mejorDist;
              mejorDist = c.dist_promedio;
              mejorUsuario = c.usuario_id;
            } else if (c.dist_promedio < segundoDist) {
              segundoDist = c.dist_promedio;
            }
          }
        }
      }

      if (!mejorUsuario) {
        console.log(`[face] login REJECTED: no match found`);
        return res.status(401).json({ error: 'Rostro no reconocido' });
      }

      const gap = segundoDist - mejorDist;
      console.log(`[face] login winner: user ${mejorUsuario}, dist=${mejorDist.toFixed(4)}, gap=${gap.toFixed(4)}`);

      if (gap < MARGEN) {
        console.log(`[face] login REJECTED: ambiguous (gap ${gap.toFixed(4)} < ${MARGEN})`);
        return res.status(401).json({ error: 'Rostro ambiguo, intente de nuevo' });
      }

      const { data: usuario } = await sb.from('usuarios').select('id, nombre, email, rol').eq('id', mejorUsuario).limit(1);

      if (!usuario || usuario.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      return res.status(200).json({
        ok: true,
        usuario_id: usuario[0].id,
        nombre: usuario[0].nombre,
        email: usuario[0].email,
        distancia: Math.round(mejorDist * 10000) / 10000,
        _debug: { umbral: UMBRAL, margen: MARGEN, dist: mejorDist, gap },
      });
    } catch (e) {
      console.error('[face] login error:', e);
      return res.status(500).json({ error: 'Error interno' });
    }
  }

  return res.status(404).json({ error: 'Accion no encontrada' });
};
