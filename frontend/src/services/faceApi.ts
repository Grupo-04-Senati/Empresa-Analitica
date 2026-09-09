const FACE_API_URL = import.meta.env.VITE_FACE_API_URL || 'http://localhost:8001';

interface FaceRegisterResponse {
  ok: boolean;
  usuario_id: number;
  valid_angles: number;
}

interface FaceLoginResponse {
  ok: boolean;
  usuario_id: number;
  nombre: string;
  email: string;
  rol: string;
  distancia: number;
}

interface FaceCheckResponse {
  count: number;
}

export async function faceApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${FACE_API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function faceApiCheckRegistered(): Promise<number> {
  try {
    const res = await fetch(`${FACE_API_URL}/face/check-registered`);
    const data: FaceCheckResponse = await res.json();
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
    const body = {
      usuario_id: usuarioId,
      frontal: photos.frontal || '',
      izquierda: photos.izquierda || '',
      derecha: photos.derecha || '',
    };

    const res = await fetch(`${FACE_API_URL}/face/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
      return { ok: false, error: err.detail || 'Error registrando rostro' };
    }

    const data: FaceRegisterResponse = await res.json();
    return { ok: data.ok };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor de reconocimiento facial' };
  }
}

export async function faceApiLogin(
  photos: Record<string, string>
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const body = {
      frontal: photos.frontal || '',
      izquierda: photos.izquierda || null,
      derecha: photos.derecha || null,
    };

    const res = await fetch(`${FACE_API_URL}/face/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error del servidor' }));
      return { ok: false, error: err.detail || 'Rostro no reconocido' };
    }

    const data: FaceLoginResponse = await res.json();
    return {
      ok: data.ok,
      usuario_id: data.usuario_id,
      nombre: data.nombre,
      email: data.email,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo conectar al servidor de reconocimiento facial' };
  }
}
