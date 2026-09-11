import { extractEmbeddings, extractEmbeddingsAndShape, detectMultipleFaces, extractFrontalShape } from './faceRecognition';
import { generateFaceSignature, Point2D } from './faceGeometry';

const FACE_API_BASE = import.meta.env.VITE_FACE_API_URL || 'https://empresa-analitica-face.onrender.com';

if (!FACE_API_BASE || FACE_API_BASE === '') {
  console.error('[faceApi] WARNING: VITE_FACE_API_URL is EMPTY! Using hardcoded fallback.');
} else {
  console.log('[faceApi] FACE_API_BASE:', FACE_API_BASE);
}

function apiUrl(action: string): string {
  if (action === 'health') return `${FACE_API_BASE}/health`;
  if (action === 'check-registered') return `${FACE_API_BASE}/face/check-registered`;
  if (action === 'register') return `${FACE_API_BASE}/face/register`;
  if (action === 'login') return `${FACE_API_BASE}/face/login`;
  if (action === 'validate') return `${FACE_API_BASE}/face/validate`;
  if (action === 'detect-angle') return `${FACE_API_BASE}/face/detect-angle`;
  return `${FACE_API_BASE}/${action}`;
}

export async function faceApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('health'));
    return res.ok;
  } catch {
    return false;
  }
}

export async function faceApiCheckRegistered(): Promise<number> {
  try {
    const res = await fetch(apiUrl('check-registered'));
    const data = await res.json();
    return data.count;
  } catch {
    return 0;
  }
}

export async function faceApiValidate(image: string): Promise<{ ok: boolean; error?: string; metricas?: any }> {
  try {
    const res = await fetch(apiUrl('validate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'No se pudo conectar al servidor de validacion' };
  }
}

export async function faceApiDetectAngle(image: string): Promise<{ ok: boolean; angle?: string; probability?: number; nose_offset?: number; error?: string }> {
  try {
    const res = await fetch(apiUrl('detect-angle'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'No se pudo conectar al servidor' };
  }
}

export async function faceApiRegister(
  usuarioId: number,
  photos: Record<string, string>
): Promise<{ ok: boolean; error?: string; missing?: string[]; faceShape?: string }> {
  try {
    const { embeddings, faceShape, proportions, landmarks } = await extractEmbeddingsAndShape(photos);
    const missing: string[] = [];
    if (!embeddings.frontal) missing.push('frontal');
    if (!embeddings.izquierda) missing.push('izquierda');
    if (!embeddings.derecha) missing.push('derecha');

    if (missing.length > 0) {
      return { ok: false, error: `No se detecto rostro en: ${missing.join(', ')}. Intenta de nuevo.`, missing };
    }

    let geometryRatios: number[] = [];
    let geometryAngles: number[] = [];
    let geometryVectors: number[] = [];
    if (landmarks && landmarks.length >= 68) {
      const pts2d: Point2D[] = landmarks.map((p: any) => ({ x: p.x, y: p.y }));
      const sig = generateFaceSignature(pts2d);
      geometryRatios = sig.ratios;
      geometryAngles = sig.angles;
      geometryVectors = sig.vectors;
    }

    const toFlatArray = (arr: any): number[] | null => {
      if (!arr) return null;
      if (Array.isArray(arr)) return arr.map(Number);
      if (arr instanceof Float32Array || arr instanceof Float64Array) return Array.from(arr).map(Number);
      return null;
    };

    const frontalArr = toFlatArray(embeddings.frontal);
    const izqArr = toFlatArray(embeddings.izquierda);
    const derArr = toFlatArray(embeddings.derecha);

    if (!frontalArr || frontalArr.length !== 128) return { ok: false, error: 'Embedding frontal invalido' };
    if (!izqArr || izqArr.length !== 128) return { ok: false, error: 'Embedding izquierda invalido' };
    if (!derArr || derArr.length !== 128) return { ok: false, error: 'Embedding derecha invalido' };

    const proporcionesData = {
      ratios: geometryRatios.map(Number),
      angles: geometryAngles.map(Number),
      vectors: geometryVectors.map(Number),
    };

    const landmarksData = landmarks ? landmarks.map((p: any) => ({ x: Number(p.x), y: Number(p.y) })) : [];

    const serverBody = {
      usuario_id: usuarioId,
      embeddings: { frontal: frontalArr, izquierda: izqArr, derecha: derArr },
      face_shape: faceShape || '',
      proporciones: proporcionesData,
      landmarks_68: landmarksData,
    };

    console.log('[faceApi] Sending to face server:', { usuario_id: usuarioId, frontalDims: frontalArr.length, ratios: geometryRatios.length });

    let serverOk = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(apiUrl('register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          serverOk = true;
          console.log('[faceApi] Face server register OK');
          return { ok: true, faceShape: faceShape || undefined };
        }
      }
      console.warn('[faceApi] Face server returned error, trying fallback');
    } catch (e: any) {
      console.warn('[faceApi] Face server unreachable:', e?.message || e, '- trying direct Supabase fallback');
    }

    if (!serverOk) {
      console.log('[faceApi] Fallback: saving directly to Supabase...');
      const { supabase } = await import('./supabase');

      const existing = await supabase.from('rostros').select('id').eq('usuario_id', usuarioId).maybeSingle();

      const pgVectorStr = (arr: number[]): string => '[' + arr.map(v => v.toFixed(6)).join(',') + ']';

      const fullData: Record<string, any> = {
        usuario_id: usuarioId,
        embedding_frontal: pgVectorStr(frontalArr),
        embedding_izquierda: pgVectorStr(izqArr),
        embedding_derecha: pgVectorStr(derArr),
        forma_rostro: faceShape || '',
        proporciones: proporcionesData,
        landmarks_68: landmarksData,
        metadata: {
          engine: 'face-api.js+fallback',
          embedding_dims: 128,
          valid_angles: 3,
          registered_via: 'direct_supabase',
          timestamp: new Date().toISOString(),
        },
      };

      const minimalData: Record<string, any> = {
        usuario_id: usuarioId,
        embedding_frontal: pgVectorStr(frontalArr),
        embedding_izquierda: pgVectorStr(izqArr),
        embedding_derecha: pgVectorStr(derArr),
        metadata: {
          engine: 'face-api.js+fallback',
          embedding_dims: 128,
          registered_via: 'direct_supabase',
          timestamp: new Date().toISOString(),
        },
      };

      const doSave = async (data: Record<string, any>) => {
        if (existing.data) {
          return await supabase.from('rostros').update(data).eq('usuario_id', usuarioId);
        } else {
          return await supabase.from('rostros').insert(data);
        }
      };

      let { error } = await doSave(fullData);
      if (error) {
        console.warn('[faceApi] Fallback full save failed, trying minimal:', error.message);
        ({ error } = await doSave(minimalData));
      }

      if (error) {
        console.error('[faceApi] Fallback minimal save also failed:', error);
        return { ok: false, error: 'Error guardando rostro: ' + error.message };
      }

      console.log('[faceApi] Fallback: rostro guardado directamente en Supabase');
      return { ok: true, faceShape: faceShape || undefined };
    }

    const errText = await (async () => { try { const r = await fetch(apiUrl('register'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return await r.json(); } catch { return { error: 'Error del servidor' }; } })();
    return { ok: false, error: errText.error || 'Error registrando rostro' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor' };
  }
}

export async function faceApiLogin(
  photos: Record<string, string>
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string; debug?: any; missing?: string[] }> {
  try {
    const photoKeys = Object.keys(photos);
    if (photoKeys.length === 0) {
      return { ok: false, error: 'No se capturaron fotos' };
    }

    const firstPhotoDataUrl = photos[photoKeys[0]];
    const img = new Image();
    img.src = firstPhotoDataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    });

    const multiCheck = await detectMultipleFaces(img);
    if (!multiCheck.ok) {
      if (multiCheck.count === 0) {
        return { ok: false, error: 'No se detecta ningun rostro. Colocate frente a la camara.' };
      }
      return { ok: false, error: 'Se detectaron multiples personas. Solo debe haber una.' };
    }

    console.log('[faceApi] multi-face check passed: 1 face detected');

    const result = await extractEmbeddingsAndShape(photos);
    const embeddings = result.embeddings;
    const landmarks = result.landmarks;
    const proportions = result.proportions;

    const presentAngles: string[] = [];
    if (embeddings.frontal) presentAngles.push('frontal');
    if (embeddings.izquierda) presentAngles.push('izquierda');
    if (embeddings.derecha) presentAngles.push('derecha');

    if (presentAngles.length < 2) {
      console.warn(`[faceApi] login REJECTED: only ${presentAngles.length} angles detected`);
      return {
        ok: false,
        error: `Solo se detecto rostro en ${presentAngles.length} de 3 angulos. Necesitas al menos 2.`,
      };
    }

    const embList: number[][] = [];
    if (embeddings.frontal) embList.push(embeddings.frontal);
    if (embeddings.izquierda) embList.push(embeddings.izquierda);
    if (embeddings.derecha) embList.push(embeddings.derecha);

    for (let i = 0; i < embList.length; i++) {
      const emb = embList[i];
      if (!emb || !Array.isArray(emb) || emb.length !== 128) {
        console.error(`[faceApi] login REJECTED: embedding[${i}] invalido`);
        return { ok: false, error: 'Error generando embedding. Intenta de nuevo.' };
      }
      const hasNaN = emb.some(v => isNaN(v));
      if (hasNaN) {
        console.error(`[faceApi] login REJECTED: embedding[${i}] contains NaN`);
        return { ok: false, error: 'Error en datos faciales. Intenta de nuevo.' };
      }
    }

    console.log(`[faceApi] login embeddings: ${embList.length}/3 angles OK, dims:`, embList[0]?.length);

    let geometryRatios: number[] = [];
    let geometryAngles: number[] = [];
    let geometryVectors: number[] = [];
    if (landmarks && landmarks.length >= 68) {
      const pts2d: Point2D[] = landmarks.map((p: any) => ({ x: p.x, y: p.y }));
      const sig = generateFaceSignature(pts2d);
      geometryRatios = sig.ratios;
      geometryAngles = sig.angles;
      geometryVectors = sig.vectors;
      console.log('[faceApi] login geometry:', {
        ratios: geometryRatios.length,
        angles: geometryAngles.length,
        vectors: geometryVectors.length,
      });
    }

    const frontalPhoto = photos['frontal'] || photos[Object.keys(photos)[0]];
    const loginFaceShape = frontalPhoto ? await extractFrontalShape(frontalPhoto) : null;

    const loginBody = {
      embeddings: embList,
      face_shape: loginFaceShape,
      proporciones: {
        ratios: geometryRatios,
        angles: geometryAngles,
        vectors: geometryVectors,
      },
      landmarks_68: landmarks,
    };

    let serverOk = false;
    let serverResult: any = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(apiUrl('login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        serverResult = await res.json();
        if (serverResult.ok) {
          serverOk = true;
          console.log('[faceApi] Face server login OK');
          return {
            ok: true,
            usuario_id: serverResult.usuario_id,
            nombre: serverResult.nombre,
            email: serverResult.email,
            debug: serverResult._debug,
          };
        }
      }
      console.warn('[faceApi] Face server login failed, trying fallback');
    } catch (e: any) {
      console.warn('[faceApi] Face server unreachable for login:', e?.message || e, '- trying direct Supabase fallback');
    }

    if (!serverOk) {
      console.log('[faceApi] Login fallback: comparing embeddings client-side...');
      const { supabase } = await import('./supabase');

      const { data: rostros, error } = await supabase
        .from('rostros')
        .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha, proporciones, landmarks_68');

      if (error) {
        console.error('[faceApi] Fallback query error:', error);
        return { ok: false, error: 'Error consultando rostros: ' + error.message };
      }

      if (!rostros || rostros.length === 0) {
        return { ok: false, error: 'No hay usuarios con rostro registrado. Primero debes registrarte desde "Crear Cuenta".' };
      }

      function cosineDistance(a: number[], b: number[]): number {
        if (a.length !== b.length) return 1;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          normA += a[i] * a[i];
          normB += b[i] * b[i];
        }
        return 1 - (dot / (Math.sqrt(normA) * Math.sqrt(normB)));
      }

      function parseVector(v: any): number[] | null {
        if (!v) return null;
        if (Array.isArray(v)) return v.map(Number);
        if (typeof v === 'string') {
          try {
            const parsed = JSON.parse(v.replace('[', '[').replace(']', ']'));
            return Array.isArray(parsed) ? parsed.map(Number) : null;
          } catch { return null; }
        }
        return null;
      }

      const UMBRAL = 0.45;
      const MIN_MATCHES = 2;
      const userScores: { userId: number; bestDist: number; matchCount: number }[] = [];

      for (const r of rostros) {
        const uid = r.usuario_id;
        const storedEmbeds: number[][] = [];
        const fe = parseVector(r.embedding_frontal);
        const fi = parseVector(r.embedding_izquierda);
        const fd = parseVector(r.embedding_derecha);
        if (fe && fe.length === 128) storedEmbeds.push(fe);
        if (fi && fi.length === 128) storedEmbeds.push(fi);
        if (fd && fd.length === 128) storedEmbeds.push(fd);

        if (storedEmbeds.length < 2) continue;

        let matchCount = 0;
        let totalDist = 0;

        for (const loginEmb of embList) {
          let bestDist = Infinity;
          for (const stored of storedEmbeds) {
            const dist = cosineDistance(loginEmb, stored);
            if (dist < bestDist) bestDist = dist;
          }
          if (bestDist <= UMBRAL) {
            matchCount++;
            totalDist += bestDist;
          }
        }

        console.log(`[faceApi] Fallback login vs user ${uid}: matchCount=${matchCount}, avgDist=${(matchCount > 0 ? totalDist / matchCount : 999).toFixed(4)}`);

        if (matchCount >= MIN_MATCHES) {
          userScores.push({ userId: uid, bestDist: totalDist / matchCount, matchCount });
        }
      }

      if (userScores.length === 0) {
        return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
      }

      userScores.sort((a, b) => a.bestDist - b.bestDist);

      if (userScores.length > 1 && (userScores[1].bestDist - userScores[0].bestDist) < 0.05) {
        return { ok: false, error: 'Rostro ambiguo, intente de nuevo' };
      }

      const winner = userScores[0];
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', winner.userId)
        .maybeSingle();

      if (!usuario) {
        return { ok: false, error: 'Usuario no encontrado' };
      }

      console.log(`[faceApi] Fallback LOGIN OK: user ${winner.userId} dist=${winner.bestDist.toFixed(4)}`);
      return {
        ok: true,
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
      };
    }

    if (serverResult && !serverResult.ok) {
      return { ok: false, error: serverResult.error || 'Rostro no reconocido', debug: serverResult._debug };
    }

    return { ok: false, error: 'Error del servidor' };
  } catch (e: any) {
    console.error(`[faceApi] LOGIN ERROR:`, e.message);
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor' };
  }
}
