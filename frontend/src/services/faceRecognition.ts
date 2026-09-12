import * as faceapi from 'face-api.js';
import { supabase } from './supabase';
import { classifyFromLandmarks, FaceProportions, FaceShape, FaceLandmark } from './faceShapeClassification';
import { normalizeLandmarksByNose, compareNormalizedLandmarks, Point2D, generateRatioSignature } from './faceGeometry';

const MODEL_URL = '/models';

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;
  modelsLoading = (async () => {
    console.log('[faceRec] Loading models from', MODEL_URL);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Model loading timeout (15s)')), 15000));
    await Promise.race([
      Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL).then(() => console.log('[faceRec] tinyFaceDetector loaded')),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL).then(() => console.log('[faceRec] faceLandmark68Net loaded')),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL).then(() => console.log('[faceRec] faceRecognitionNet loaded')),
      ]),
      timeout,
    ]);
    console.log('[faceRec] All models loaded');
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

export function cosineDistance(a: number[], b: number[]): number {
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

export function cosineSimilarity(a: number[], b: number[]): number {
  return 1 - cosineDistance(a, b);
}

export function l2Normalize(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
  }
  return embedding;
}

export async function extractEmbeddings(photos: Record<string, string>): Promise<{ frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null }> {
  const result: { frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null } = { frontal: null, izquierda: null, derecha: null };

  for (const [angle, dataUrl] of Object.entries(photos)) {
    if (!dataUrl || !result.hasOwnProperty(angle)) continue;
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const isFrontal = angle === 'frontal';

      const detectionScoreThreshold = isFrontal ? 0.5 : 0.3;
      const minEyeDist = isFrontal ? 20 : 12;
      const minNonZero = isFrontal ? 64 : 48;

      const detection = await (faceapi as any)
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: detectionScoreThreshold }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.warn(`[face] No se detecto rostro en ${angle} (threshold: ${detectionScoreThreshold})`);
        continue;
      }

      if (detection.detection.score < detectionScoreThreshold) {
        console.warn(`[face] Score muy bajo en ${angle}: ${detection.detection.score} (min: ${detectionScoreThreshold})`);
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
      if (eyeDist < minEyeDist) {
        console.warn(`[face] Ojos muy pequenos en ${angle}: ${eyeDist} (min: ${minEyeDist})`);
        continue;
      }

      const noseToEye = Math.sqrt((nose.x - (leftEye.x + rightEye.x) / 2) ** 2 + (nose.y - (leftEye.y + rightEye.y) / 2) ** 2);
      const faceRatio = noseToEye / eyeDist;
      if (faceRatio < 0.05 || faceRatio > 3.0) {
        console.warn(`[face] Proporcion facial invalida en ${angle}: ${faceRatio}`);
        continue;
      }

      const mouthWidth = Math.sqrt((rightMouth.x - leftMouth.x) ** 2 + (rightMouth.y - leftMouth.y) ** 2);
      const mouthToEye = mouthWidth / eyeDist;
      if (mouthToEye < 0.03 || mouthToEye > 4.0) {
        console.warn(`[face] Proporcion boca-ojos invalida en ${angle}: ${mouthToEye}`);
        continue;
      }

      const descriptor = detection.descriptor as Float32Array;
      const embedding: number[] = l2Normalize(Array.from(descriptor));

      const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
      if (nonZero < minNonZero) {
        console.warn(`[face] Embedding poco informativo en ${angle}: ${nonZero} non-zero dims (min: ${minNonZero})`);
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

export interface EmbeddingResult {
  embeddings: { frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null };
  faceShape: FaceShape | null;
  proportions: FaceProportions | null;
  landmarks: FaceLandmark[] | null;
}

/**
 * Extract embeddings AND face shape from photos.
 * Face shape is derived from the frontal photo's 68 landmarks.
 */
export async function extractEmbeddingsAndShape(photos: Record<string, string>): Promise<EmbeddingResult> {
  const embeddings: { frontal: number[] | null; izquierda: number[] | null; derecha: number[] | null } = { frontal: null, izquierda: null, derecha: null };
  let faceShape: FaceShape | null = null;
  let proportions: FaceProportions | null = null;
  let landmarks: FaceLandmark[] | null = null;

  for (const [angle, dataUrl] of Object.entries(photos)) {
    if (!dataUrl || !embeddings.hasOwnProperty(angle)) continue;
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const detection = await (faceapi as any)
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        console.warn(`[face] No se detecto rostro en ${angle}`);
        continue;
      }

      console.log(`[face] Detection ${angle}: score=${detection.detection.score.toFixed(3)}`);

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
      console.log(`[face] Metrics ${angle}: eyeDist=${eyeDist.toFixed(1)}`);
      if (eyeDist < 8) {
        console.warn(`[face] Ojos muy pequenos en ${angle}: ${eyeDist}`);
        continue;
      }

      const noseToEye = Math.sqrt((nose.x - (leftEye.x + rightEye.x) / 2) ** 2 + (nose.y - (leftEye.y + rightEye.y) / 2) ** 2);
      const faceRatio = noseToEye / eyeDist;
      if (faceRatio < 0.1 || faceRatio > 2.0) {
        console.warn(`[face] Proporcion facial invalida en ${angle}: ${faceRatio}`);
        continue;
      }

      const mouthWidth = Math.sqrt((rightMouth.x - leftMouth.x) ** 2 + (rightMouth.y - leftMouth.y) ** 2);
      const mouthToEye = mouthWidth / eyeDist;
      if (mouthToEye < 0.05 || mouthToEye > 3.0) {
        console.warn(`[face] Proporcion boca-ojos invalida en ${angle}: ${mouthToEye}`);
        continue;
      }

      const descriptor = detection.descriptor as Float32Array;
      const embedding: number[] = l2Normalize(Array.from(descriptor));

      const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
      console.log(`[face] Embedding ${angle}: dims=${embedding.length}, nonZero=${nonZero}`);
      if (nonZero < 32) {
        console.warn(`[face] Embedding poco informativo en ${angle}: ${nonZero} non-zero dims`);
        continue;
      }

      console.log(`[face] OK ${angle}: score=${detection.detection.score.toFixed(3)}, eyeDist=${eyeDist.toFixed(1)}, faceRatio=${faceRatio.toFixed(3)}, nonZero=${nonZero}`);
      (embeddings as any)[angle] = embedding;

      if (angle === 'frontal') {
        const ptsArray: FaceLandmark[] = pts.map((p: any) => ({ x: p.x, y: p.y }));
        const result = classifyFromLandmarks(ptsArray);
        faceShape = result.shape;
        proportions = result.proportions;
        landmarks = ptsArray;
        console.log(`[face] Shape: ${faceShape}`, proportions?.ratios);
      }
    } catch (e) {
      console.error(`[face] Error extracting ${angle}:`, e);
    }
  }

  return { embeddings, faceShape, proportions, landmarks };
}

export async function extractFrontalShape(photoDataUrl: string): Promise<FaceShape | null> {
  try {
    const img = new Image();
    img.src = photoDataUrl;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); });

    const detection = await (faceapi as any)
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.2 }))
      .withFaceLandmarks();

    if (!detection) return null;

    const pts = detection.landmarks.positions;
    if (pts.length < 68) return null;

    const ptsArray: FaceLandmark[] = pts.map((p: any) => ({ x: p.x, y: p.y }));
    const result = classifyFromLandmarks(ptsArray);
    return result.shape;
  } catch {
    return null;
  }
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
  probability: number;
  confidence: number;
  message: string;
  detected: boolean;
  centered: boolean;
  angleOk: boolean;
  noseOffset: number;
  faceRatio: number;
  eyeDistance: number;
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
  let noseOffsetVal = 0;
  let faceRatioVal = 0;
  let eyeDistVal = 0;
  let detectionScore = 0;

  try {
    const det = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
      .withFaceLandmarks();
    if (det) {
      detected = true;
      detectionScore = det.detection.score;
      const pts = det.landmarks.positions;
      const nose = pts[30];
      const leftEye = pts[36];
      const rightEye = pts[45];
      const leftMouth = pts[48];
      const rightMouth = pts[54];
      const centerX = (leftEye.x + rightEye.x) / 2;
      eyeDistVal = Math.abs(rightEye.x - leftEye.x);
      const rawNoseOffset = (nose.x - centerX) / eyeDistVal;
      noseOffsetVal = -rawNoseOffset;
      centered = Math.abs(noseOffsetVal) < 0.35;

      const noseToEye = Math.sqrt((nose.x - (leftEye.x + rightEye.x) / 2) ** 2 + (nose.y - (leftEye.y + rightEye.y) / 2) ** 2);
      faceRatioVal = eyeDistVal > 0 ? noseToEye / eyeDistVal : 0;

      const mouthWidth = Math.sqrt((rightMouth.x - leftMouth.x) ** 2 + (rightMouth.y - leftMouth.y) ** 2);

      if (angle === 'frontal') angleOk = Math.abs(noseOffsetVal) < 0.35;
      else if (angle === 'izquierda') angleOk = noseOffsetVal > 0.1;
      else if (angle === 'derecha') angleOk = noseOffsetVal < -0.1;
      else angleOk = true;
    }
  } catch {}

  let probFace = detected ? detectionScore : 0;
  let probAngle = angleOk ? 0.95 : Math.max(0, 0.5 - Math.abs(noseOffsetVal) * 0.5);
  let probCentered = centered ? 0.9 : Math.max(0, 0.6 - Math.abs(noseOffsetVal) * 0.4);
  let probQuality = 0;
  if (brightness >= 50 && brightness <= 210) probQuality += 0.3;
  if (blur >= 8) probQuality += 0.3;
  if (eyeDistVal > 15) probQuality += 0.2;
  if (faceRatioVal > 0.1 && faceRatioVal < 2.0) probQuality += 0.2;

  const probability = (probFace * 0.4 + probAngle * 0.3 + probCentered * 0.2 + probQuality * 0.1);
  const confidence = detected ? Math.min(1, detectionScore * (1 - Math.abs(noseOffsetVal) * 0.3)) : 0;

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

  return { brightness, blur, size: 1, score, probability, confidence, message, detected, centered, angleOk, noseOffset: noseOffsetVal, faceRatio: faceRatioVal, eyeDistance: eyeDistVal };
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
    const noseOffset = -(nose.x - centerX) / eyeDist;

    if (angle === 'frontal') return { ok: Math.abs(noseOffset) < 0.35 };
    if (angle === 'izquierda') return { ok: noseOffset > 0.1 };
    if (angle === 'derecha') return { ok: noseOffset < -0.1 };
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
    const numericUserId = Number(userId);
    if (!numericUserId || isNaN(numericUserId)) {
      return { ok: false, error: 'ID de usuario invalido' };
    }

    const { data: userCheck } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', numericUserId)
      .maybeSingle();

    if (!userCheck) {
      return { ok: false, error: 'Usuario no encontrado. Crea tu cuenta primero.' };
    }

    const result = await extractEmbeddingsAndShape(photos);
    const embeddings = result.embeddings;
    const faceShape = result.faceShape;
    const proportions = result.proportions;
    const landmarks = result.landmarks;

    const validCount = Object.values(embeddings).filter(e => e !== null).length;
    if (validCount < 2) {
      return { ok: false, error: 'Se necesitan al menos 2 fotos con rostro detectado correctamente.' };
    }

    await supabase.from('rostros').delete().eq('usuario_id', userId);

    const metadata: Record<string, any> = {};
    if (proportions) metadata.proporciones = proportions;
    if (landmarks) metadata.landmarks_68 = landmarks;
    if (faceShape) metadata.forma_rostro = faceShape;
    metadata.registration_date = new Date().toISOString();
    metadata.valid_angles = validCount;
    metadata.embedding_dims = embeddings.frontal?.length || 128;

    const lmPts: Point2D[] = Array.isArray(landmarks)
      ? landmarks.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
      : [];
    const normalizedLandmarks = lmPts.length >= 68 ? normalizeLandmarksByNose(lmPts) : lmPts;

    // Calcular ratios de proporciones (invariantes a distancia)
    const ratioSignature = lmPts.length >= 68 ? generateRatioSignature(lmPts) : [];

    const { error } = await supabase.from('rostros').insert({
      usuario_id: userId,
      embedding_frontal: embeddings.frontal,
      embedding_izquierda: embeddings.izquierda,
      embedding_derecha: embeddings.derecha,
      forma_rostro: faceShape || '',
      landmarks_68: normalizedLandmarks,
      proporciones: { ratios: ratioSignature },
      metadata,
    });

    if (error) {
      return { ok: false, error: 'Error guardando en servidor: ' + error.message };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error registrando rostro' };
  }
}

export async function loginByFace(
  photos: Record<string, string>
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const loginEmbeddings: number[][] = [];
    const loginLandmarks: Point2D[][] = [];

    for (const [angle, dataUrl] of Object.entries(photos)) {
      if (!dataUrl) continue;
      try {
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => { img.onload = () => resolve(); });

        const detection = await (faceapi as any)
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          console.warn(`[face-login] No face detected in ${angle}`);
          continue;
        }

        if (detection.detection.score < 0.3) {
          console.warn(`[face-login] Low score in ${angle}: ${detection.detection.score}`);
          continue;
        }

        const pts = detection.landmarks.positions;
        if (pts.length < 68) continue;

        const leftEye = pts[36];
        const rightEye = pts[45];
        const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
        if (eyeDist < 15) continue;

        const descriptor = detection.descriptor as Float32Array;
        const embedding: number[] = Array.from(descriptor);
        const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
        if (norm > 0) {
          for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
        }

        const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
        if (nonZero >= 32) {
          loginEmbeddings.push(embedding);
        }

        const pts2d: Point2D[] = pts.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
        const normalized = normalizeLandmarksByNose(pts2d);
        loginLandmarks.push(normalized);

        console.log(`[face-login] OK ${angle}: score=${detection.detection.score.toFixed(3)}, emb=${embedding.length}, nonZero=${nonZero}`);
      } catch {}
    }

    console.log(`[face-login] Captured: ${loginEmbeddings.length} embeddings, ${loginLandmarks.length} landmarks`);

    if (loginEmbeddings.length === 0 && loginLandmarks.length === 0) {
      return { ok: false, error: 'No se detecto ningun rostro' };
    }

    const { data: rostros } = await supabase
      .from('rostros')
      .select('usuario_id, landmarks_68, embedding_frontal, embedding_izquierda, embedding_derecha');

    if (!rostros || rostros.length === 0) {
      return { ok: false, error: 'No hay usuarios con rostro registrado. Registrate primero.' };
    }

    // --- PASO 1: Intentar con embeddings (mas robusto) ---
    const UMBRAL_EMB = 0.20;
    const embScores: { userId: number; dist: number }[] = [];

    if (loginEmbeddings.length > 0) {
      for (const r of rostros) {
        const uid = r.usuario_id;
        const storedEmbeds: number[][] = [];
        if (r.embedding_frontal) storedEmbeds.push(r.embedding_frontal);
        if (r.embedding_izquierda) storedEmbeds.push(r.embedding_izquierda);
        if (r.embedding_derecha) storedEmbeds.push(r.embedding_derecha);

        if (storedEmbeds.length === 0) continue;

        let totalBest = 0;
        let matchCount = 0;

        for (const loginEmb of loginEmbeddings) {
          let bestDist = Infinity;
          for (const stored of storedEmbeds) {
            const dist = cosineDistance(loginEmb, stored);
            if (dist < bestDist) bestDist = dist;
          }
          if (bestDist <= UMBRAL_EMB) {
            totalBest += bestDist;
            matchCount++;
          }
        }

        console.log(`[face-login] Emb vs user ${uid}: matchCount=${matchCount}, avgDist=${(matchCount > 0 ? totalBest / matchCount : 999).toFixed(4)}`);

        if (matchCount >= 1) {
          embScores.push({ userId: uid, dist: totalBest / matchCount });
        }
      }
    }

    if (embScores.length > 0) {
      embScores.sort((a, b) => a.dist - b.dist);
      const winner = embScores[0];
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', winner.userId)
        .limit(1);

      if (usuario && usuario.length > 0) {
        console.log(`[face-login] EMB MATCH: user ${winner.userId} dist=${winner.dist.toFixed(4)}`);
        return { ok: true, usuario_id: usuario[0].id, nombre: usuario[0].nombre, email: usuario[0].email };
      }
    }

    // --- PASO 2: Fallback con geometria ---
    const UMBRAL_GEO = 0.15;
    const geoScores: { userId: number; dist: number }[] = [];

    if (loginLandmarks.length > 0) {
      for (const r of rostros) {
        const uid = r.usuario_id;
        const storedLm = r.landmarks_68;
        if (!storedLm || storedLm.length < 68) continue;

        let storedNorm: Point2D[] = storedLm.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));

        const avgAbs = storedNorm.reduce((s, p) => s + Math.abs(p.x) + Math.abs(p.y), 0) / storedNorm.length;
        if (avgAbs > 5) {
          const dIo = Math.sqrt((storedNorm[45].x - storedNorm[36].x) ** 2 + (storedNorm[45].y - storedNorm[36].y) ** 2);
          if (dIo > 0) {
            const noseTip = storedNorm[30];
            storedNorm = storedNorm.map(p => ({ x: (p.x - noseTip.x) / dIo, y: (p.y - noseTip.y) / dIo }));
          }
        }

        let bestGeoDist = Infinity;
        for (const capNorm of loginLandmarks) {
          const dist = compareNormalizedLandmarks(storedNorm, capNorm);
          if (dist < bestGeoDist) bestGeoDist = dist;
        }

        console.log(`[face-login] Geo vs user ${uid}: bestDist=${bestGeoDist.toFixed(4)}`);

        if (bestGeoDist <= UMBRAL_GEO) {
          geoScores.push({ userId: uid, dist: bestGeoDist });
        }
      }
    }

    if (geoScores.length > 0) {
      geoScores.sort((a, b) => a.dist - b.dist);
      const winner = geoScores[0];
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', winner.userId)
        .limit(1);

      if (usuario && usuario.length > 0) {
        console.log(`[face-login] GEO MATCH: user ${winner.userId} dist=${winner.dist.toFixed(4)}`);
        return { ok: true, usuario_id: usuario[0].id, nombre: usuario[0].nombre, email: usuario[0].email };
      }
    }

    return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error en login facial' };
  }
}

export async function detectMultipleFaces(input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<{ ok: boolean; count: number }> {
  try {
    const detections = await (faceapi as any)
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
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
    const loginLandmarks: Point2D[][] = [];
    const angles = ['frontal', 'izquierda', 'derecha'];

    for (const angle of angles) {
      await new Promise<void>((r) => setTimeout(r, 800));

      const det = await (faceapi as any)
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!det || det.detection.score < 0.3) continue;

      const pts = det.landmarks.positions;
      if (pts.length < 68) continue;

      const leftEye = pts[36];
      const rightEye = pts[45];
      const eyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
      if (eyeDist < 15) continue;

      const descriptor = det.descriptor as Float32Array;
      const embedding: number[] = Array.from(descriptor);
      const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
      if (norm > 0) {
        for (let i = 0; i < embedding.length; i++) embedding[i] /= norm;
      }

      const nonZero = embedding.filter(v => Math.abs(v) > 0.001).length;
      if (nonZero >= 32) {
        loginEmbeddings.push(embedding);
      }

      const pts2d: Point2D[] = pts.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
      const normalized = normalizeLandmarksByNose(pts2d);
      loginLandmarks.push(normalized);
    }

    console.log(`[face-login-liveness] Captured: ${loginEmbeddings.length} embeddings, ${loginLandmarks.length} landmarks`);

    if (loginEmbeddings.length === 0 && loginLandmarks.length === 0) {
      return { ok: false, error: 'No se pudieron capturar suficientes angulos. Intente de nuevo.' };
    }

    const { data: rostros } = await supabase
      .from('rostros')
      .select('usuario_id, landmarks_68, embedding_frontal, embedding_izquierda, embedding_derecha');

    if (!rostros || rostros.length === 0) {
      return { ok: false, error: 'No hay usuarios con rostro registrado.' };
    }

    // --- PASO 1: Intentar con embeddings ---
    const UMBRAL_EMB = 0.20;
    const embScores: { userId: number; dist: number }[] = [];

    if (loginEmbeddings.length > 0) {
      for (const r of rostros) {
        const uid = r.usuario_id;
        const storedEmbeds: number[][] = [];
        if (r.embedding_frontal) storedEmbeds.push(r.embedding_frontal);
        if (r.embedding_izquierda) storedEmbeds.push(r.embedding_izquierda);
        if (r.embedding_derecha) storedEmbeds.push(r.embedding_derecha);

        if (storedEmbeds.length === 0) continue;

        let totalBest = 0;
        let matchCount = 0;

        for (const loginEmb of loginEmbeddings) {
          let bestDist = Infinity;
          for (const stored of storedEmbeds) {
            const dist = cosineDistance(loginEmb, stored);
            if (dist < bestDist) bestDist = dist;
          }
          if (bestDist <= UMBRAL_EMB) {
            totalBest += bestDist;
            matchCount++;
          }
        }

        if (matchCount >= 1) {
          embScores.push({ userId: uid, dist: totalBest / matchCount });
        }
      }
    }

    if (embScores.length > 0) {
      embScores.sort((a, b) => a.dist - b.dist);
      const winner = embScores[0];
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', winner.userId)
        .limit(1);

      if (usuario && usuario.length > 0) {
        console.log(`[face-login-liveness] EMB MATCH: user ${winner.userId}`);
        return { ok: true, usuario_id: usuario[0].id, nombre: usuario[0].nombre, email: usuario[0].email };
      }
    }

    // --- PASO 2: Fallback con geometria ---
    const UMBRAL_GEO = 0.15;
    const geoScores: { userId: number; dist: number }[] = [];

    if (loginLandmarks.length > 0) {
      for (const r of rostros) {
        const uid = r.usuario_id;
        const storedLm = r.landmarks_68;
        if (!storedLm || storedLm.length < 68) continue;

        let storedNorm: Point2D[] = storedLm.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));

        const avgAbs = storedNorm.reduce((s, p) => s + Math.abs(p.x) + Math.abs(p.y), 0) / storedNorm.length;
        if (avgAbs > 5) {
          const dIo = Math.sqrt((storedNorm[45].x - storedNorm[36].x) ** 2 + (storedNorm[45].y - storedNorm[36].y) ** 2);
          if (dIo > 0) {
            const noseTip = storedNorm[30];
            storedNorm = storedNorm.map(p => ({ x: (p.x - noseTip.x) / dIo, y: (p.y - noseTip.y) / dIo }));
          }
        }

        let bestGeoDist = Infinity;
        for (const capNorm of loginLandmarks) {
          const dist = compareNormalizedLandmarks(storedNorm, capNorm);
          if (dist < bestGeoDist) bestGeoDist = dist;
        }

        if (bestGeoDist <= UMBRAL_GEO) {
          geoScores.push({ userId: uid, dist: bestGeoDist });
        }
      }
    }

    if (geoScores.length > 0) {
      geoScores.sort((a, b) => a.dist - b.dist);
      const winner = geoScores[0];
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', winner.userId)
        .limit(1);

      if (usuario && usuario.length > 0) {
        console.log(`[face-login-liveness] GEO MATCH: user ${winner.userId}`);
        return { ok: true, usuario_id: usuario[0].id, nombre: usuario[0].nombre, email: usuario[0].email };
      }
    }

    return { ok: false, error: 'Rostro no reconocido. Debes registrarte primero.' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error en login facial' };
  }
}

