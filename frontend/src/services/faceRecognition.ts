import * as faceapi from 'face-api.js';
import { supabase } from './supabase';

const MODEL_URL = '/models';

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;
  modelsLoading = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    modelsLoading = null;
  })();
  return modelsLoading;
}

export interface DetectionResult {
  detected: boolean;
  count: number;
  box: { x: number; y: number; width: number; height: number } | null;
  landmarks: faceapi.FaceLandmarks68 | null;
  score: number;
  croppedImage: string | null;
}

export async function detectFace(input: HTMLVideoElement | HTMLCanvasElement): Promise<DetectionResult> {
  try {
    const inputW = (input as HTMLVideoElement).videoWidth || input.clientWidth;
    const inputH = (input as HTMLVideoElement).videoHeight || input.clientHeight;
    const shortSide = Math.min(inputW, inputH);
    const inputSize = shortSide > 500 ? 416 : 320;

    const detections = await (faceapi as any)
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.35 }))
      .withFaceLandmarks();

    if (!detections || detections.length === 0) {
      return { detected: false, count: 0, box: null, landmarks: null, score: 0, croppedImage: null };
    }

    if (detections.length > 1) {
      return { detected: false, count: detections.length, box: null, landmarks: null, score: 0, croppedImage: null };
    }

    const det = detections[0];
    const box = det.detection.box;
    const inputEl = input as HTMLVideoElement;
    const vW = inputEl.videoWidth || input.clientWidth;
    const vH = inputEl.videoHeight || input.clientHeight;

    const scaleX = vW / input.clientWidth;
    const scaleY = vH / input.clientHeight;

    const absBox = {
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    };

    const pad = 0.2;
    const x1 = Math.max(0, Math.floor(absBox.x - absBox.width * pad));
    const y1 = Math.max(0, Math.floor(absBox.y - absBox.height * pad));
    const x2 = Math.min(vW, Math.ceil(absBox.x + absBox.width * (1 + pad)));
    const y2 = Math.min(vH, Math.ceil(absBox.y + absBox.height * (1 + pad)));

    const canvas = document.createElement('canvas');
    canvas.width = x2 - x1;
    canvas.height = y2 - y1;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(inputEl, x1, y1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    return {
      detected: true,
      count: 1,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      landmarks: det.landmarks,
      score: det.detection.score,
      croppedImage: canvas.toDataURL('image/jpeg', 0.9),
    };
  } catch {
    return { detected: false, count: 0, box: null, landmarks: null, score: 0, croppedImage: null };
  }
}

export async function captureMultipleAngles(video: HTMLVideoElement, count: number = 3, delay: number = 1500): Promise<Record<string, string>> {
  const photos: Record<string, string> = {};
  const angles = ['frontal', 'izquierda', 'derecha'];

  for (let i = 0; i < count; i++) {
    await new Promise<void>((r) => setTimeout(r, delay));
    const result = await detectFace(video);
    if (result.detected && result.croppedImage) {
      photos[angles[i] || `foto_${i}`] = result.croppedImage;
    }
  }
  return photos;
}

export async function faceScanLoop(
  video: HTMLVideoElement,
  onProgress: (stage: number, message: string) => void,
  onCapture: (photos: Record<string, string>) => void,
  maxAttempts: number = 40
): Promise<void> {
  const capturedAngles = new Set<string>();
  const angles = ['frontal', 'izquierda', 'derecha'];
  let attempts = 0;

  const expectedCount = 3;

  while (capturedAngles.size < expectedCount && attempts < maxAttempts) {
    await new Promise<void>((r) => setTimeout(r, 1200));
    attempts++;

    const result = await detectFace(video);

    if (!result.detected || !result.croppedImage) {
      onProgress(capturedAngles.size, 'Acercate a la camara');
      continue;
    }

    if (result.count > 1) {
      onProgress(capturedAngles.size, 'Solo debe haber una persona');
      continue;
    }

    if (result.score < 0.4) {
      onProgress(capturedAngles.size, 'Mira directamente a la camara');
      continue;
    }

    const angleIdx = capturedAngles.size;
    const angle = angles[angleIdx];

    const quality = await analyzeFaceQuality(video, angle);
    if (!quality.detected || !quality.centered || !quality.angleOk) {
      onProgress(capturedAngles.size, quality.message);
      continue;
    }

    capturedAngles.add(angle);

    onProgress(capturedAngles.size, `Capturado: ${angle}. ${expectedCount - capturedAngles.size} restantes`);

    if (capturedAngles.size === expectedCount) {
      const photos: Record<string, string> = {};
      let idx = 0;
      for (const a of angles) {
        const det = await detectFace(video);
        if (det.detected && det.croppedImage) {
          photos[a] = det.croppedImage;
        }
        idx++;
        await new Promise<void>((r) => setTimeout(r, 1000));
      }

      if (Object.keys(photos).length >= 2) {
        onCapture(photos);
        return;
      } else {
        capturedAngles.clear();
        onProgress(0, 'Error al capturar. Intenta de nuevo.');
      }
    }
  }

  if (capturedAngles.size < expectedCount) {
    onProgress(capturedAngles.size, 'No se pudo capturar. Intenta de nuevo.');
  }
}

function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - Math.max(-1, Math.min(1, similarity));
}

export async function extractEmbeddings(photos: Record<string, string>): Promise<{ frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null }> {
  const result: { frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null } = { frontal: null, izquierda: null, derecha: null };

  for (const [angle, dataUrl] of Object.entries(photos)) {
    if (!dataUrl || !result.hasOwnProperty(angle)) continue;
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const detection = await (faceapi as any)
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection && detection.detection.score >= 0.5) {
        const descriptor = detection.descriptor as Float32Array;
        const embedding: number[] = Array.from(descriptor);
        const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
        if (norm > 0) {
          for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
        }
        (result as any)[angle] = embedding;
      }
    } catch (e) {
      console.error(`[face] Error extracting ${angle}:`, e);
    }
  }

  return result;
}

export async function hasFaceRegistered(userId: number): Promise<boolean> {
  const { data } = await supabase
    .from('rostros')
    .select('id')
    .eq('usuario_id', userId)
    .limit(1);
  return (data && data.length > 0) || false;
}

export async function deleteFaceEmbeddings(userId: number): Promise<void> {
  await supabase.from('rostros').delete().eq('usuario_id', userId);
}

export async function hasAnyFaceRegistered(): Promise<boolean> {
  const { data } = await supabase
    .from('rostros')
    .select('id')
    .limit(1);
  return (data && data.length > 0) || false;
}

export interface FaceQuality {
  brightness: number;
  blur: number;
  size: number;
  score: number;
  message: string;
  detected: boolean;
  centered: boolean;
  angleOk: boolean;
}

export async function analyzeFaceQuality(input: HTMLVideoElement | HTMLCanvasElement, angle?: string): Promise<FaceQuality> {
  const canvas = document.createElement('canvas');
  const w = (input as HTMLVideoElement).videoWidth || input.clientWidth;
  const h = (input as HTMLVideoElement).videoHeight || input.clientHeight;
  canvas.width = Math.min(w, 320);
  canvas.height = Math.min(h, 240);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const brightness = sum / (data.length / 4);

  let lapSum = 0;
  for (let y = 1; y < canvas.height - 1; y++) {
    for (let x = 1; x < canvas.width - 1; x++) {
      const idx = (y * canvas.width + x) * 4;
      const center = data[idx];
      const top = data[((y - 1) * canvas.width + x) * 4];
      const bottom = data[((y + 1) * canvas.width + x) * 4];
      const left = data[(y * canvas.width + (x - 1)) * 4];
      const right = data[(y * canvas.width + (x + 1)) * 4];
      lapSum += Math.abs(4 * center - top - bottom - left - right);
    }
  }
  const blur = lapSum / ((canvas.width - 2) * (canvas.height - 2));

  let detected = false;
  let centered = false;
  let angleOk = false;

  try {
    const det = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks();
    if (det) {
      detected = true;
      const pts = det.landmarks.positions;
      const nose = pts[30];
      const leftEye = pts[36];
      const rightEye = pts[45];
      const centerX = (leftEye.x + rightEye.x) / 2;
      const eyeDist = Math.abs(rightEye.x - leftEye.x);
      const noseOffset = (nose.x - centerX) / eyeDist;
      centered = Math.abs(noseOffset) < 0.25;
      if (angle === 'frontal') angleOk = Math.abs(noseOffset) < 0.2;
      else if (angle === 'izquierda') angleOk = noseOffset > 0.2;
      else if (angle === 'derecha') angleOk = noseOffset < -0.2;
      else angleOk = true;
    }
  } catch {}

  let score = 0;
  let message = 'Detectando...';
  if (detected) score += 0.4;
  if (centered) score += 0.3;
  if (angleOk) score += 0.3;
  if (brightness < 50) { message = 'Muy oscuro'; }
  else if (brightness > 210) { message = 'Muy brillante'; }
  else if (blur < 8) { message = 'Imagen borrosa'; }
  else if (!detected) { message = 'Buscando rostro...'; }
  else if (!centered) { message = 'Centra tu cara'; }
  else if (!angleOk) { message = 'Ajusta el angulo'; }
  else { message = 'Buena calidad'; }

  return { brightness, blur, size: 1, score, message, detected, centered, angleOk };
}

export async function checkAngle(input: HTMLVideoElement | HTMLCanvasElement, angle: string): Promise<{ ok: boolean }> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks();

    if (!detection) return { ok: false };

    const pts = detection.landmarks.positions;
    const nose = pts[30];
    const leftEye = pts[36];
    const rightEye = pts[45];
    const centerX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.abs(rightEye.x - leftEye.x);
    const noseOffset = (nose.x - centerX) / eyeDist;

    if (angle === 'frontal') return { ok: Math.abs(noseOffset) < 0.2 };
    if (angle === 'izquierda') return { ok: noseOffset > 0.2 };
    if (angle === 'derecha') return { ok: noseOffset < -0.2 };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function normalizeLandmarks(landmarks: faceapi.FaceLandmarks68): number[] {
  const pts = landmarks.positions;
  const leftEye = pts[36];
  const rightEye = pts[45];
  const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
  if (eyeDist === 0) return [];

  const nose = pts[30];
  const normalized: number[] = [];
  for (const p of pts) {
    normalized.push((p.x - nose.x) / eyeDist);
    normalized.push((p.y - nose.y) / eyeDist);
  }
  return normalized;
}

function landmarkDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum / a.length);
}

async function generateFullDescriptor(input: HTMLVideoElement | HTMLCanvasElement): Promise<{ embedding: number[]; landmarks: number[]; score: number } | null> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    if (detection.detection.score < 0.6) return null;

    const descriptor = detection.descriptor as Float32Array;
    const embedding: number[] = Array.from(descriptor);
    const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
    }

    const landmarks = normalizeLandmarks(detection.landmarks);
    if (landmarks.length === 0) return null;

    return { embedding, landmarks, score: detection.detection.score };
  } catch {
    return null;
  }
}

async function detectBlink(video: HTMLVideoElement, frameCount: number = 10): Promise<{ blinked: boolean; earHistory: number[] }> {
  const earHistory: number[] = [];

  for (let i = 0; i < frameCount; i++) {
    await new Promise<void>((r) => setTimeout(r, 100));

    try {
      const det = await (faceapi as any)
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks();

      if (det) {
        const pts = det.landmarks.positions;
        const leftEye = pts.slice(36, 42);
        const rightEye = pts.slice(42, 48);

        function eyeAspectRatio(eye: { x: number; y: number }[]): number {
          const vertical1 = Math.sqrt((eye[1].x - eye[5].x) ** 2 + (eye[1].y - eye[5].y) ** 2);
          const vertical2 = Math.sqrt((eye[2].x - eye[4].x) ** 2 + (eye[2].y - eye[4].y) ** 2);
          const horizontal = Math.sqrt((eye[0].x - eye[3].x) ** 2 + (eye[0].y - eye[3].y) ** 2);
          return (vertical1 + vertical2) / (2.0 * horizontal);
        }

        const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;
        earHistory.push(ear);
      }
    } catch {}
  }

  if (earHistory.length < 3) return { blinked: false, earHistory };

  const avgEar = earHistory.reduce((a, b) => a + b, 0) / earHistory.length;
  const minEar = Math.min(...earHistory);
  const blinked = minEar < avgEar * 0.65;

  return { blinked, earHistory };
}

export async function registerFace(
  userId: number,
  photos: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const samples: { embedding: number[]; landmarks: number[]; score: number }[] = [];

    for (const dataUrl of Object.values(photos)) {
      if (!dataUrl) continue;
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const desc = await generateFullDescriptor(canvas);
      if (desc && desc.score >= 0.65) {
        samples.push(desc);
      }
    }

    if (samples.length < 3) {
      return { ok: false, error: 'Se necesitan 3 fotos con calidad alta. Mira directamente a la camara.' };
    }

    const avgScore = samples.reduce((s, d) => s + d.score, 0) / samples.length;
    if (avgScore < 0.7) {
      return { ok: false, error: 'Calidad insuficiente. Acercate mas a la camara y mira al frente.' };
    }

    await supabase.from('rostros').delete().eq('usuario_id', userId);

    for (const s of samples) {
      await supabase.from('rostros').insert({
        usuario_id: userId,
        embedding: s.embedding,
        foto_preview: null,
      });
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error registrando rostro' };
  }
}

const UMBRAL_EMBEDDING = 0.18;
const UMBRAL_LANDMARK = 0.12;
const MIN_MATCHES = 3;

export async function loginByFace(
  photos: Record<string, string>
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const loginDescriptors: { embedding: number[]; landmarks: number[]; score: number }[] = [];

    for (const dataUrl of Object.values(photos)) {
      if (!dataUrl) continue;
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const desc = await generateFullDescriptor(canvas);
      if (desc) loginDescriptors.push(desc);
    }

    if (loginDescriptors.length === 0) {
      return { ok: false, error: 'No se detecto ningun rostro' };
    }

    const { data: rostros } = await supabase
      .from('rostros')
      .select('usuario_id, embedding');

    if (!rostros || rostros.length === 0) {
      return { ok: false, error: 'No hay usuarios con rostro registrado. Registrate primero.' };
    }

    const userEmbDistances: Record<number, number[]> = {};
    const userLandmarkDistances: Record<number, number[]> = {};

    for (const loginDesc of loginDescriptors) {
      for (const r of rostros) {
        const embDist = cosineDistance(loginDesc.embedding, r.embedding);
        const uid = r.usuario_id;
        if (!userEmbDistances[uid]) userEmbDistances[uid] = [];
        userEmbDistances[uid].push(embDist);
      }
    }

    const embCandidates: { userId: number; bestEmbDist: number; matchCount: number }[] = [];

    for (const [uid, dists] of Object.entries(userEmbDistances)) {
      const withinThreshold = dists.filter(d => d <= UMBRAL_EMBEDDING);
      if (withinThreshold.length >= MIN_MATCHES) {
        embCandidates.push({
          userId: Number(uid),
          bestEmbDist: Math.min(...withinThreshold),
          matchCount: withinThreshold.length,
        });
      }
    }

    if (embCandidates.length === 0) {
      return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
    }

    embCandidates.sort((a, b) => a.bestEmbDist - b.bestEmbDist);

    if (embCandidates.length > 1) {
      const gap = embCandidates[1].bestEmbDist - embCandidates[0].bestEmbDist;
      if (gap < 0.08) {
        return { ok: false, error: 'Rostro ambiguo, intente de nuevo' };
      }
    }

    const winner = embCandidates[0];
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('id', winner.userId)
      .limit(1);

    if (!usuario || usuario.length === 0) {
      return { ok: false, error: 'Usuario no encontrado' };
    }

    return {
      ok: true,
      usuario_id: usuario[0].id,
      nombre: usuario[0].nombre,
      email: usuario[0].email,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error en login facial' };
  }
}
