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
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
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

    if (result.score < 0.3) {
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
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.warn(`[face] No se detecto rostro en ${angle}`);
        continue;
      }

      if (detection.detection.score < 0.4) {
        console.warn(`[face] Score muy bajo en ${angle}: ${detection.detection.score}`);
        continue;
      }

      const pts = detection.landmarks.positions;
      if (pts.length < 68) {
        console.warn(`[face] Landmarks insuficientes en ${angle}: ${pts.length}`);
        continue;
      }

      const leftEye = pts[36];
      const rightEye = pts[45];
      const nose = pts[30];
      const leftMouth = pts[48];
      const rightMouth = pts[54];
      const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
      if (eyeDist < 15) {
        console.warn(`[face] Ojos muy pequenos en ${angle}: ${eyeDist}`);
        continue;
      }

      const noseToEye = Math.sqrt((nose.x - (leftEye.x + rightEye.x) / 2) ** 2 + (nose.y - (leftEye.y + rightEye.y) / 2) ** 2);
      const faceRatio = noseToEye / eyeDist;
      if (faceRatio < 0.2 || faceRatio > 1.5) {
        console.warn(`[face] Proporcion facial invalida en ${angle}: ${faceRatio}`);
        continue;
      }

      const mouthWidth = Math.sqrt((rightMouth.x - leftMouth.x) ** 2 + (rightMouth.y - leftMouth.y) ** 2);
      const mouthToEye = mouthWidth / eyeDist;
      if (mouthToEye < 0.1 || mouthToEye > 2.5) {
        console.warn(`[face] Proporcion boca-ojos invalida en ${angle}: ${mouthToEye}`);
        continue;
      }

      const descriptor = detection.descriptor as Float32Array;
      const embedding: number[] = Array.from(descriptor);
      const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
      if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
      }

      const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
      if (nonZero < 64) {
        console.warn(`[face] Embedding poco informativo en ${angle}: ${nonZero} non-zero dims`);
        continue;
      }

      console.log(`[face] OK ${angle}: score=${detection.detection.score.toFixed(3)}, eyeDist=${eyeDist.toFixed(1)}, faceRatio=${faceRatio.toFixed(3)}, nonZero=${nonZero}`);
      (result as any)[angle] = embedding;
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
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
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
  if (detected) score += 0.5;
  if (centered) score += 0.25;
  if (angleOk) score += 0.25;
  if (brightness < 50) { message = 'Muy oscuro'; }
  else if (brightness > 210) { message = 'Muy brillante'; }
  else if (blur < 8) { message = 'Imagen borrosa'; }
  else if (!detected) { message = 'Buscando rostro...'; }
  else if (!angleOk) { message = 'Ajusta el angulo'; }
  else { message = 'Buena calidad'; }

  return { brightness, blur, size: 1, score, message, detected, centered, angleOk };
}

export async function checkAngle(input: HTMLVideoElement | HTMLCanvasElement, angle: string): Promise<{ ok: boolean }> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
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
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    if (detection.detection.score < 0.3) return null;

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

export async function detectHeadTurn(video: HTMLVideoElement, durationMs: number = 4500): Promise<{ turned: boolean; yawHistory: number[] }> {
  const yawHistory: number[] = [];

  if (!video || video.readyState < 2) {
    await new Promise<void>((r) => setTimeout(r, 500));
    if (!video || video.readyState < 2) return { turned: true, yawHistory: [] };
  }

  const frameInterval = 80;
  const totalFrames = Math.floor(durationMs / frameInterval);

  for (let i = 0; i < totalFrames; i++) {
    await new Promise<void>((r) => setTimeout(r, frameInterval));

    try {
      if (video.readyState < 2) continue;

      const det = await (faceapi as any)
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks();

      if (det && det.landmarks) {
        const pts = det.landmarks.positions;
        if (pts.length >= 31) {
          const leftEyeInner = pts[39];
          const rightEyeInner = pts[35];
          const noseTip = pts[30];

          const eyeCenterX = (leftEyeInner.x + rightEyeInner.x) / 2;
          const interEyeDist = Math.hypot(rightEyeInner.x - leftEyeInner.x, rightEyeInner.y - leftEyeInner.y);

          if (interEyeDist > 10) {
            const rawYaw = (noseTip.x - eyeCenterX) / interEyeDist;
            yawHistory.push(rawYaw);
          }
        }
      }
    } catch {}
  }

  if (yawHistory.length < 8) return { turned: true, yawHistory: [] };

  const smoothed: number[] = [];
  const windowSize = 3;
  for (let i = 0; i < yawHistory.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(yawHistory.length, i + Math.floor(windowSize / 2) + 1);
    const slice = yawHistory.slice(start, end);
    smoothed.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }

  const initialFrames = smoothed.slice(0, Math.min(5, Math.floor(smoothed.length * 0.15)));
  const baselineYaw = initialFrames.reduce((a, b) => a + b, 0) / initialFrames.length;

  const maxLeft = Math.max(...smoothed);
  const maxRight = Math.min(...smoothed);

  const turnedLeft = (baselineYaw - maxLeft) > 0.18;
  const turnedRight = (maxRight - baselineYaw) > 0.18;

  const turned = turnedLeft || turnedRight;

  return { turned, yawHistory: smoothed };
}

export async function registerFace(
  userId: number,
  photos: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const embeddings: { frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null } = { frontal: null, izquierda: null, derecha: null };

    for (const [angle, dataUrl] of Object.entries(photos)) {
      if (!dataUrl || !embeddings.hasOwnProperty(angle)) continue;
      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); });

        const detection = await (faceapi as any)
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection || detection.detection.score < 0.5) continue;

        const pts = detection.landmarks.positions;
        if (pts.length < 68) continue;

        const leftEye = pts[36];
        const rightEye = pts[45];
        const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
        if (eyeDist < 20) continue;

        const descriptor = detection.descriptor as Float32Array;
        const embedding: number[] = Array.from(descriptor);
        const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
        if (norm > 0) {
          for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
        }

        const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
        if (nonZero < 64) continue;

        (embeddings as any)[angle] = embedding;
      } catch (e) {
        console.error(`[face-register] Error extracting ${angle}:`, e);
      }
    }

    const validCount = Object.values(embeddings).filter(e => e !== null).length;
    if (validCount < 2) {
      return { ok: false, error: 'Se necesitan al menos 2 fotos con rostro detectado correctamente.' };
    }

    await supabase.from('rostros').delete().eq('usuario_id', userId);

    const { error } = await supabase.from('rostros').insert({
      usuario_id: userId,
      embedding_frontal: embeddings.frontal,
      embedding_izquierda: embeddings.izquierda,
      embedding_derecha: embeddings.derecha,
    });

    if (error) {
      return { ok: false, error: 'Error guardando en servidor: ' + error.message };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error registrando rostro' };
  }
}

const UMBRAL_EMBEDDING = 0.18;
const MIN_MATCHES = 3;

export async function loginByFace(
  photos: Record<string, string>
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const loginEmbeddings: number[][] = [];

    for (const [angle, dataUrl] of Object.entries(photos)) {
      if (!dataUrl) continue;
      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); });

        const detection = await (faceapi as any)
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          console.warn(`[face-login] No face detected in ${angle}`);
          continue;
        }

        if (detection.detection.score < 0.5) {
          console.warn(`[face-login] Low score in ${angle}: ${detection.detection.score}`);
          continue;
        }

        const pts = detection.landmarks.positions;
        if (pts.length < 68) continue;

        const leftEye = pts[36];
        const rightEye = pts[45];
        const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
        if (eyeDist < 20) continue;

        const descriptor = detection.descriptor as Float32Array;
        const embedding: number[] = Array.from(descriptor);
        const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
        if (norm > 0) {
          for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
        }

        const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
        if (nonZero < 64) {
          console.warn(`[face-login] Uninformative embedding in ${angle}: ${nonZero}`);
          continue;
        }

        loginEmbeddings.push(embedding);
        console.log(`[face-login] OK ${angle}: score=${detection.detection.score.toFixed(3)}, dims=${embedding.length}, nonZero=${nonZero}`);
      } catch {}
    }

    if (loginEmbeddings.length === 0) {
      return { ok: false, error: 'No se detecto ningun rostro' };
    }

    const { data: rostros } = await supabase
      .from('rostros')
      .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha');

    if (!rostros || rostros.length === 0) {
      return { ok: false, error: 'No hay usuarios con rostro registrado. Registrate primero.' };
    }

    const userResults: { userId: number; avgDist: number; matchCount: number }[] = [];

    for (const r of rostros) {
      const uid = r.usuario_id;
      const storedEmbeds: number[][] = [];
      if (r.embedding_frontal) storedEmbeds.push(r.embedding_frontal);
      if (r.embedding_izquierda) storedEmbeds.push(r.embedding_izquierda);
      if (r.embedding_derecha) storedEmbeds.push(r.embedding_derecha);

      if (storedEmbeds.length < 2) continue;

      let totalBestDist = 0;
      let matchCount = 0;

      for (const loginEmb of loginEmbeddings) {
        let bestDistForThisLogin = Infinity;
        for (const stored of storedEmbeds) {
          const dist = cosineDistance(loginEmb, stored);
          if (dist < bestDistForThisLogin) bestDistForThisLogin = dist;
        }
        if (bestDistForThisLogin <= UMBRAL_EMBEDDING) {
          totalBestDist += bestDistForThisLogin;
          matchCount++;
        }
      }

      console.log(`[face-login] user ${uid}: matchCount=${matchCount}, avgDist=${(matchCount > 0 ? totalBestDist / matchCount : 999).toFixed(4)}`);

      if (matchCount >= MIN_MATCHES) {
        const avgDist = totalBestDist / matchCount;
        userResults.push({ userId: uid, avgDist, matchCount });
      }
    }

    if (userResults.length === 0) {
      return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
    }

    userResults.sort((a, b) => a.avgDist - b.avgDist);

    if (userResults.length > 1 && (userResults[1].avgDist - userResults[0].avgDist) < 0.15) {
      return { ok: false, error: 'Rostro ambiguo, intente de nuevo' };
    }

    const winner = userResults[0];
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('id', winner.userId)
      .limit(1);

    if (!usuario || usuario.length === 0) {
      return { ok: false, error: 'Usuario no encontrado' };
    }

    console.log(`[face-login] MATCH: user ${winner.userId} (${winner.avgDist.toFixed(4)})`);

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

export async function detectMultipleFaces(input: HTMLVideoElement | HTMLCanvasElement): Promise<{ ok: boolean; count: number }> {
  try {
    const detections = await (faceapi as any)
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withFaceLandmarks();

    if (!detections || detections.length === 0) return { ok: false, count: 0 };
    if (detections.length > 1) return { ok: false, count: detections.length };
    return { ok: true, count: 1 };
  } catch {
    return { ok: false, count: 0 };
  }
}

export async function loginByFaceWithLiveness(
  video: HTMLVideoElement
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const multiCheck = await detectMultipleFaces(video);
    if (!multiCheck.ok) {
      if (multiCheck.count === 0) return { ok: false, error: 'No se detecto ningun rostro. Mire a la camara.' };
      return { ok: false, error: 'Se detectaron multiples rostros. Solo debe haber una persona.' };
    }

    const yawResult = await detectHeadTurn(video, 4500);
    if (!yawResult.turned) {
      return { ok: false, error: 'Giro de cabeza no detectado. Gire la cabeza lentamente a un lado.' };
    }

    const loginEmbeddings: number[][] = [];
    const angles = ['frontal', 'izquierda', 'derecha'];

    for (const angle of angles) {
      await new Promise<void>((r) => setTimeout(r, 800));

      const det = await (faceapi as any)
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det || det.detection.score < 0.5) continue;

      const pts = det.landmarks.positions;
      if (pts.length < 68) continue;

      const leftEye = pts[36];
      const rightEye = pts[45];
      const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
      if (eyeDist < 20) continue;

      const descriptor = det.descriptor as Float32Array;
      const embedding: number[] = Array.from(descriptor);
      const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
      if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
      }

      const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
      if (nonZero < 64) continue;

      loginEmbeddings.push(embedding);
    }

    if (loginEmbeddings.length < 2) {
      return { ok: false, error: 'No se pudieron capturar suficientes angulos. Intente de nuevo.' };
    }

    const { data: rostros } = await supabase
      .from('rostros')
      .select('usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha');

    if (!rostros || rostros.length === 0) {
      return { ok: false, error: 'No hay usuarios con rostro registrado.' };
    }

    const userResults: { userId: number; avgDist: number; matchCount: number }[] = [];

    for (const r of rostros) {
      const uid = r.usuario_id;
      const storedEmbeds: number[][] = [];
      if (r.embedding_frontal) storedEmbeds.push(r.embedding_frontal);
      if (r.embedding_izquierda) storedEmbeds.push(r.embedding_izquierda);
      if (r.embedding_derecha) storedEmbeds.push(r.embedding_derecha);

      if (storedEmbeds.length < 2) continue;

      let totalBestDist = 0;
      let matchCount = 0;

      for (const loginEmb of loginEmbeddings) {
        let bestDistForThisLogin = Infinity;
        for (const stored of storedEmbeds) {
          const dist = cosineDistance(loginEmb, stored);
          if (dist < bestDistForThisLogin) bestDistForThisLogin = dist;
        }
        if (bestDistForThisLogin <= UMBRAL_EMBEDDING) {
          totalBestDist += bestDistForThisLogin;
          matchCount++;
        }
      }

      if (matchCount >= MIN_MATCHES) {
        const avgDist = totalBestDist / matchCount;
        userResults.push({ userId: uid, avgDist, matchCount });
      }
    }

    if (userResults.length === 0) {
      return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
    }

    userResults.sort((a, b) => a.avgDist - b.avgDist);

    if (userResults.length > 1 && (userResults[1].avgDist - userResults[0].avgDist) < 0.15) {
      return { ok: false, error: 'Rostro ambiguo. Asegurese de que solo su rostro este visible.' };
    }

    const winner = userResults[0];
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
