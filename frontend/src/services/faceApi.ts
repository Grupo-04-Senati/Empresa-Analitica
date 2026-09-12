import * as faceapi from 'face-api.js';
import { extractEmbeddings, extractEmbeddingsAndShape, detectMultipleFaces, extractFrontalShape } from './faceRecognition';
import { generateFaceSignature, normalizeLandmarksByNose, compareNormalizedLandmarks, Point2D } from './faceGeometry';

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
    const normalizedLandmarks = landmarksData.length >= 68 ? normalizeLandmarksByNose(landmarksData) : landmarksData;

    const interEyeDist = landmarksData.length >= 68
      ? Math.sqrt((landmarksData[45].x - landmarksData[36].x) ** 2 + (landmarksData[45].y - landmarksData[36].y) ** 2)
      : 0;

    const serverBody = {
      usuario_id: usuarioId,
      embeddings: { frontal: frontalArr, izquierda: izqArr, derecha: derArr },
      face_shape: faceShape || '',
      proporciones: proporcionesData,
      landmarks_68: normalizedLandmarks,
      interocular_distance: interEyeDist,
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
        landmarks_68: normalizedLandmarks,
        interocular_distance: interEyeDist,
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
        landmarks_68: normalizedLandmarks,
        interocular_distance: interEyeDist,
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
      console.log('[faceApi] Login fallback: comparing normalized landmarks geometrically...');
      const { supabase } = await import('./supabase');

      const { data: rostros, error } = await supabase
        .from('rostros')
        .select('usuario_id, landmarks_68, embedding_frontal, embedding_izquierda, embedding_derecha');

      if (error) {
        console.error('[faceApi] Fallback query error:', error);
        return { ok: false, error: 'Error consultando rostros: ' + error.message };
      }

      if (!rostros || rostros.length === 0) {
        return { ok: false, error: 'No hay usuarios con rostro registrado. Primero debes registrarte desde "Crear Cuenta".' };
      }

      const UMBRAL_GEO = 0.15;
      const geoScores: { userId: number; dist: number }[] = [];

      for (const r of rostros) {
        const storedLm = r.landmarks_68;
        if (!storedLm || storedLm.length < 68) continue;

        let bestAngleDist = Infinity;

        for (const angle of presentAngles) {
          const anglePhotos = angle === 'frontal' ? photos['frontal'] : angle === 'izquierda' ? photos['izquierda'] : photos['derecha'];
          if (!anglePhotos) continue;

          const img2 = new Image();
          img2.src = anglePhotos;
          await new Promise<void>((res) => { img2.onload = () => res(); });

          try {
            const det = await (faceapi as any)
              .detectSingleFace(img2, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
              .withFaceLandmarks();

            if (!det || !det.landmarks) continue;

            const capPts = det.landmarks.positions.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
            if (capPts.length < 68) continue;

            const capNorm = normalizeLandmarksByNose(capPts);
            let storedNorm: Point2D[] = storedLm.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));

            const avgAbs = storedNorm.reduce((s: number, p: Point2D) => s + Math.abs(p.x) + Math.abs(p.y), 0) / storedNorm.length;
            if (avgAbs > 5) {
              const dIo = Math.sqrt((storedNorm[45].x - storedNorm[36].x) ** 2 + (storedNorm[45].y - storedNorm[36].y) ** 2);
              if (dIo > 0) {
                const noseTip = storedNorm[30];
                storedNorm = storedNorm.map(p => ({ x: (p.x - noseTip.x) / dIo, y: (p.y - noseTip.y) / dIo }));
              }
            }

            const dist = compareNormalizedLandmarks(storedNorm, capNorm);
            if (dist < bestAngleDist) bestAngleDist = dist;
          } catch {}
        }

        console.log(`[faceApi] Geometric vs user ${r.usuario_id}: dist=${bestAngleDist.toFixed(4)}`);

        if (bestAngleDist <= UMBRAL_GEO) {
          geoScores.push({ userId: r.usuario_id, dist: bestAngleDist });
        }
      }

      if (geoScores.length === 0) {
        return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
      }

      geoScores.sort((a, b) => a.dist - b.dist);

      if (geoScores.length > 1 && (geoScores[1].dist - geoScores[0].dist) < 0.05) {
        return { ok: false, error: 'Rostro ambiguo, intente de nuevo con mejor iluminacion' };
      }

      const winner = geoScores[0];
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', winner.userId)
        .maybeSingle();

      if (!usuario) {
        return { ok: false, error: 'Usuario no encontrado' };
      }

      console.log(`[faceApi] Geometric LOGIN OK: user ${winner.userId} dist=${winner.dist.toFixed(4)}`);
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
