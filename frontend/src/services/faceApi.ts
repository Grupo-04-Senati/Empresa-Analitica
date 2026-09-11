import { extractEmbeddings, extractEmbeddingsAndShape, detectMultipleFaces, extractFrontalShape } from './faceRecognition';
import { generateFaceSignature, Point2D } from './faceGeometry';

const FACE_API_BASE = import.meta.env.VITE_FACE_API_URL || '';

if (!FACE_API_BASE) {
  console.error('[faceApi] WARNING: VITE_FACE_API_URL is EMPTY! Face registration will fail.');
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
      console.log('[faceApi] geometry calculated:', {
        ratios: geometryRatios.length,
        angles: geometryAngles.length,
        vectors: geometryVectors.length,
        sampleRatios: geometryRatios.slice(0, 3).map(r => r.toFixed(4)),
        sampleAngles: geometryAngles.slice(0, 3).map(a => a.toFixed(1)),
      });
    }

    console.log('[faceApi] register embeddings:', {
      frontal: embeddings.frontal ? `${embeddings.frontal.length} dims` : 'NULL',
      izquierda: embeddings.izquierda ? `${embeddings.izquierda.length} dims` : 'NULL',
      derecha: embeddings.derecha ? `${embeddings.derecha.length} dims` : 'NULL',
      faceShape,
    });

    const body = {
      usuario_id: usuarioId,
      embeddings,
      face_shape: faceShape,
      proporciones: {
        ...(proportions || {}),
        ratios: geometryRatios,
        angles: geometryAngles,
        vectors: geometryVectors,
      },
      landmarks_68: landmarks,
    };
    console.log('[faceApi] register body:', JSON.stringify({ usuario_id: usuarioId, embeddingsKeys: Object.keys(embeddings), ratiosCount: geometryRatios.length, anglesCount: geometryAngles.length }));

    const res = await fetch(apiUrl('register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
      return { ok: false, error: err.error || 'Error registrando rostro' };
    }

    return { ok: true };
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

    const embeddings = await extractEmbeddings(photos);

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

    const frontalPhoto = photos['frontal'] || photos[Object.keys(photos)[0]];
    const loginFaceShape = frontalPhoto ? await extractFrontalShape(frontalPhoto) : null;
    console.log('[faceApi] login face shape detected:', loginFaceShape);

    const res = await fetch(apiUrl('login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddings: embList, face_shape: loginFaceShape }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
      const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app');
      const debugMsg = isDev && err._debug
        ? ` (dist: ${err._debug.avgDist?.toFixed(3)}, umbral: ${err._debug.umbral})`
        : '';
      console.error(`[audit] LOGIN REJECTED by server:`, err.error, err._debug);
      return { ok: false, error: (err.error || 'Rostro no reconocido') + debugMsg, debug: err._debug };
    }

    const data = await res.json();

    if (!data.ok) {
      console.error(`[audit] LOGIN REJECTED: server returned ok=false`);
      return { ok: false, error: data.error || 'Rostro no reconocido', debug: data._debug };
    }

    if (data.usuario_id === undefined || data.usuario_id === null || isNaN(Number(data.usuario_id))) {
      console.error(`[audit] LOGIN REJECTED: server returned invalid usuario_id:`, data.usuario_id);
      return { ok: false, error: 'Error en respuesta del servidor' };
    }

    if (data.distancia !== undefined && data.distancia !== null) {
      const dist = Number(data.distancia);
      if (isNaN(dist) || dist < 0 || dist > 1) {
        console.error(`[audit] LOGIN REJECTED: server returned invalid distancia:`, data.distancia);
        return { ok: false, error: 'Error en calculo de distancias' };
      }
    }

    const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app');
    if (isDev && data._debug) {
      console.log(`[faceApi] DEBUG: embeddings=${data._debug.embeddingsReceived}, threshold=${data._debug.threshold}, avgSimilarity=${data._debug.avgSimilarity?.toFixed(4)}, avgDistance=${data._debug.avgDistance?.toFixed(4)}, matches=${data._debug.matchCount}`);
    }

    console.log(`[audit] LOGIN OK: user ${data.usuario_id}, nombre=${data.nombre}`);
    return {
      ok: data.ok,
      usuario_id: data.usuario_id,
      nombre: data.nombre,
      email: data.email,
      debug: data._debug,
    };
  } catch (e: any) {
    console.error(`[audit] LOGIN ERROR (exception):`, e.message);
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor' };
  }
}
