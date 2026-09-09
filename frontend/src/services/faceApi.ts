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
): Promise<{ ok: boolean; error?: string }> {
  try {
    const embeddings = await extractEmbeddings(photos);
    const validCount = Object.values(embeddings).filter(e => e !== null).length;

    if (validCount < 2) {
      return { ok: false, error: 'No se detecto rostro en al menos 2 fotos' };
    }

    const res = await fetch(apiUrl('register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuarioId, embeddings }),
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
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const embeddings = await extractEmbeddings(photos);
    const embList = Object.values(embeddings).filter((e): e is number[] => e !== null);

    if (embList.length === 0) {
      return { ok: false, error: 'No se detecto ningun rostro' };
    }

    const res = await fetch(apiUrl('login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddings: embList }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
      return { ok: false, error: err.error || 'Rostro no reconocido' };
    }

    const data = await res.json();
    return {
      ok: data.ok,
      usuario_id: data.usuario_id,
      nombre: data.nombre,
      email: data.email,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor' };
  }
}
