import { extractEmbeddings } from './faceRecognition';

const FACE_API_BASE = import.meta.env.VITE_FACE_API_URL || '';

function apiUrl(action: string): string {
  return `${FACE_API_BASE}/api/face?action=${action}`;
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

export async function faceApiRegister(
  usuarioId: number,
  photos: Record<string, string>
): Promise<{ ok: boolean; error?: string; missing?: string[] }> {
  try {
    const embeddings = await extractEmbeddings(photos);
    const missing: string[] = [];
    if (!embeddings.frontal) missing.push('frontal');
    if (!embeddings.izquierda) missing.push('izquierda');
    if (!embeddings.derecha) missing.push('derecha');

    if (missing.length > 0) {
      return { ok: false, error: `No se detecto rostro en: ${missing.join(', ')}. Intenta de nuevo.`, missing };
    }

    console.log('[faceApi] register embeddings:', {
      frontal: embeddings.frontal ? `${embeddings.frontal.length} dims` : 'NULL',
      izquierda: embeddings.izquierda ? `${embeddings.izquierda.length} dims` : 'NULL',
      derecha: embeddings.derecha ? `${embeddings.derecha.length} dims` : 'NULL',
    });

    const body = { usuario_id: usuarioId, embeddings };
    console.log('[faceApi] register body:', JSON.stringify({ usuario_id: usuarioId, embeddingsKeys: Object.keys(embeddings), embeddingsValues: Object.values(embeddings).map(e => e ? e.length : null) }));

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
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string; debug?: any }> {
  try {
    const embeddings = await extractEmbeddings(photos);
    const embList = Object.values(embeddings).filter((e): e is number[] => e !== null);

    if (embList.length === 0) {
      return { ok: false, error: 'No se detecto ningun rostro' };
    }

    console.log('[faceApi] login embeddings:', embList.length, 'dims:', embList[0]?.length);

    const res = await fetch(apiUrl('login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddings: embList }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
      const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app');
      const debugMsg = isDev && err._debug
        ? ` (dist: ${err._debug.avgDist?.toFixed(3)}, umbral: ${err._debug.umbral})`
        : '';
      return { ok: false, error: (err.error || 'Rostro no reconocido') + debugMsg, debug: err._debug };
    }

    const data = await res.json();
    const isDev = window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app');
    if (isDev && data._debug) {
      console.log(`[faceApi] DEBUG: avgDist=${data._debug.avgDist?.toFixed(4)}, umbral=${data._debug.umbral}, gap=${data._debug.gap?.toFixed(4)}`);
    }
    return {
      ok: data.ok,
      usuario_id: data.usuario_id,
      nombre: data.nombre,
      email: data.email,
      debug: data._debug,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor' };
  }
}
