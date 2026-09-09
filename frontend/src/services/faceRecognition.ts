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

// ── ETAPA 1: DETECCION + MULTI-FACE + RECORTE ──────────────

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
    const inputSize = shortSide > 500 ? 320 : 160;

    const detections = await (faceapi as any)
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.2 }))
      .withFaceLandmarks();

    if (!detections || detections.length === 0) {
      return { detected: false, count: 0, box: null, landmarks: null, score: 0, croppedImage: null };
    }

    if (detections.length > 1) {
      return { detected: false, count: detections.length, box: null, landmarks: null, score: 0, croppedImage: null };
    }

    const det = detections[0];
    const box = det.detection.box;
    const landmarks = det.landmarks;
    const score = det.detection.score;

    const videoW = (input as HTMLVideoElement).videoWidth || input.clientWidth;
    const videoH = (input as HTMLVideoElement).videoHeight || input.clientHeight;

    const padding = Math.max(box.width, box.height) * 0.3;
    const x1 = Math.max(0, box.x - padding);
    const y1 = Math.max(0, box.y - padding);
    const x2 = Math.min(videoW, box.x + box.width + padding);
    const y2 = Math.min(videoH, box.y + box.height + padding);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 160;
    tempCanvas.height = 160;
    const ctx = tempCanvas.getContext('2d')!;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = videoW;
    srcCanvas.height = videoH;
    const srcCtx = srcCanvas.getContext('2d')!;
    if (input instanceof HTMLVideoElement) {
      srcCtx.drawImage(input, 0, 0, videoW, videoH);
    } else {
      srcCtx.drawImage(input, 0, 0, videoW, videoH);
    }

    ctx.drawImage(srcCanvas, x1, y1, x2 - x1, y2 - y1, 0, 0, 160, 160);
    const croppedImage = tempCanvas.toDataURL('image/jpeg', 0.95);

    return {
      detected: true,
      count: 1,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      landmarks,
      score,
      croppedImage,
    };
  } catch {
    return { detected: false, count: 0, box: null, landmarks: null, score: 0, croppedImage: null };
  }
}

// ── ETAPA 2: LIVENESS DETECTION ────────────────────────────

export interface LivenessResult {
  isLive: boolean;
  blinkDetected: boolean;
  textureOk: boolean;
  message: string;
  eyeAspectRatio: number;
}

function eyeAspectRatio(eye: { x: number; y: number }[]): number {
  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  return (v1 + v2) / (2.0 * h);
}

export function analyzeLiveness(
  landmarks: any,
  previousEARs: number[]
): LivenessResult {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const leftEAR = eyeAspectRatio(leftEye);
  const rightEAR = eyeAspectRatio(rightEye);
  const avgEAR = (leftEAR + rightEAR) / 2;

  const blinkThreshold = 0.21;
  const blinkDetected = avgEAR < blinkThreshold;

  const recentEARs = previousEARs.slice(-10);
  const hasBlinkHistory = recentEARs.some(e => e < blinkThreshold);

  const nose = landmarks.getNose();
  const mouth = landmarks.getMouth();
  const jaw = landmarks.getJawOutline();

  const noseStability = nose.length > 0;
  const mouthStability = mouth.length > 0;
  const jawStability = jaw.length > 0;

  let textureOk = true;
  if (previousEARs.length > 3) {
    const earVariance = recentEARs.reduce((sum, e) => sum + Math.abs(e - avgEAR), 0) / recentEARs.length;
    textureOk = earVariance > 0.001;
  }

  let isLive = false;
  let message = '';

  if (hasBlinkHistory || blinkDetected) {
    isLive = true;
    message = 'Parpadeo detectado - Rostro vivo';
  } else if (noseStability && mouthStability && jawStability) {
    isLive = true;
    message = 'Rostro estabilizado - Vivo';
  } else {
    message = 'Manten el rostro quieto y parpadea naturalmente';
  }

  return { isLive, blinkDetected: hasBlinkHistory, textureOk, message, eyeAspectRatio: avgEAR };
}

// ── ETAPA 3: LANDMARKS + DISTANCIAS ────────────────────────

export interface FaceMetrics {
  interOcularDistance: number;
  noseLength: number;
  jawWidth: number;
  mouthWidth: number;
  faceWidth: number;
  faceHeight: number;
}

export function calculateFaceMetrics(landmarks: any): FaceMetrics {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const mouth = landmarks.getMouth();
  const jaw = landmarks.getJawOutline();

  const interOcularDistance = Math.hypot(
    leftEye[0].x - rightEye[3].x,
    leftEye[0].y - rightEye[3].y
  );

  const noseLength = Math.hypot(nose[0].x - nose[3].x, nose[0].y - nose[3].y);

  const jawWidth = Math.hypot(jaw[0].x - jaw[16].x, jaw[0].y - jaw[16].y);

  const mouthWidth = Math.hypot(mouth[0].x - mouth[6].x, mouth[0].y - mouth[6].y);

  const faceWidth = Math.hypot(jaw[0].x - jaw[16].x, jaw[0].y - jaw[16].y);
  const faceHeight = Math.hypot(
    (leftEye[0].x + rightEye[3].x) / 2 - (mouth[2].x + mouth[10].x) / 2,
    (leftEye[0].y + rightEye[3].y) / 2 - (mouth[2].y + mouth[10].y) / 2
  );

  return { interOcularDistance, noseLength, jawWidth, mouthWidth, faceWidth, faceHeight };
}

// ── ETAPA 4: EMBEDDING + COMPARACION ───────────────────────

export interface FaceQuality {
  centered: boolean;
  angleOk: boolean;
  detected: boolean;
  message: string;
  score: number;
}

export async function analyzeFaceQuality(
  input: HTMLVideoElement | HTMLCanvasElement,
  targetAngle: 'frontal' | 'izquierda' | 'derecha' = 'frontal'
): Promise<FaceQuality> {
  try {
    const inputW = (input as HTMLVideoElement).videoWidth || input.clientWidth;
    const inputH = (input as HTMLVideoElement).videoHeight || input.clientHeight;
    const shortSide = Math.min(inputW, inputH);
    const inputSize = shortSide > 500 ? 320 : 160;

    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.2 }))
      .withFaceLandmarks();

    if (!detection) {
      return { centered: false, angleOk: false, detected: false, message: 'Coloque su rostro frente a la camara', score: 0 };
    }

    const landmarks = detection.landmarks;
    const box = detection.detection.box;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const normX = centerX / inputW;
    const normY = centerY / inputH;
    const centered = Math.abs(normX - 0.5) < 0.25 && Math.abs(normY - 0.5) < 0.25;

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();

    const eyeLeftX = leftEye[0].x;
    const eyeRightX = rightEye[3].x;
    const eyeSpan = eyeRightX - eyeLeftX;
    const noseTipX = nose[3].x;
    const noseRelative = (noseTipX - eyeLeftX) / eyeSpan;
    const yaw = (noseRelative - 0.5) * 120;

    let angleOk = false;
    let message = '';
    if (targetAngle === 'frontal') {
      angleOk = Math.abs(yaw) < 12;
      message = angleOk ? 'Rostro detectado' : yaw < -8 ? 'Gira a la DERECHA' : 'Gira a la IZQUIERDA';
    } else if (targetAngle === 'izquierda') {
      angleOk = yaw > 8 && yaw < 50;
      message = angleOk ? 'Angulo izquierdo OK' : yaw <= 8 ? 'Gira a la IZQUIERDA' : 'Vuelve al frente';
    } else {
      angleOk = yaw < -8 && yaw > -50;
      message = angleOk ? 'Angulo derecho OK' : yaw >= -8 ? 'Gira a la DERECHA' : 'Vuelve al frente';
    }

    if (!centered) message = 'Centra tu rostro en la pantalla';

    const totalScore = (centered ? 0.4 : 0) + (angleOk ? 0.6 : 0);

    return { centered, angleOk, detected: true, message, score: totalScore };
  } catch {
    return { centered: false, angleOk: false, detected: false, message: 'Error detectando', score: 0 };
  }
}

export async function checkAngle(
  input: HTMLVideoElement | HTMLCanvasElement,
  targetAngle: 'frontal' | 'izquierda' | 'derecha'
): Promise<{ ok: boolean; yaw: number }> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
      .withFaceLandmarks();

    if (!detection) return { ok: false, yaw: 0 };

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();

    const eyeLeftX = leftEye[0].x;
    const eyeRightX = rightEye[3].x;
    const eyeSpan = eyeRightX - eyeLeftX;
    const noseTipX = nose[3].x;
    const noseRelative = (noseTipX - eyeLeftX) / eyeSpan;
    const yaw = (noseRelative - 0.5) * 120;

    if (targetAngle === 'frontal') return { ok: Math.abs(yaw) < 8, yaw };
    if (targetAngle === 'izquierda') return { ok: yaw > 12 && yaw < 45, yaw };
    return { ok: yaw < -12 && yaw > -45, yaw };
  } catch {
    return { ok: false, yaw: 0 };
  }
}

// ── CHALLENGE-RESPONSE ─────────────────────────────────────

export type ChallengeType = 'blink' | 'turn_left' | 'turn_right' | 'smile';

export function getRandomChallenge(): ChallengeType {
  const challenges: ChallengeType[] = ['blink', 'turn_left', 'turn_right', 'smile'];
  return challenges[Math.floor(Math.random() * challenges.length)];
}

export function validateChallenge(
  type: ChallengeType,
  landmarks: any,
  previousYaw: number[]
): boolean {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const mouth = landmarks.getMouth();
  const nose = landmarks.getNose();

  switch (type) {
    case 'blink': {
      const leftEAR = eyeAspectRatio(leftEye);
      const rightEAR = eyeAspectRatio(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2;
      return avgEAR < 0.21;
    }
    case 'turn_left': {
      const recentYaw = previousYaw.slice(-5);
      return recentYaw.some(y => y > 15);
    }
    case 'turn_right': {
      const recentYaw = previousYaw.slice(-5);
      return recentYaw.some(y => y < -15);
    }
    case 'smile': {
      const mouthOpen = Math.hypot(mouth[2].x - mouth[10].x, mouth[2].y - mouth[10].y);
      const mouthWidth = Math.hypot(mouth[0].x - mouth[6].x, mouth[0].y - mouth[6].y);
      return mouthOpen / mouthWidth > 0.4;
    }
    default:
      return false;
  }
}

export function getChallengeLabel(type: ChallengeType): string {
  switch (type) {
    case 'blink': return 'Parpadea dos veces';
    case 'turn_left': return 'Gira la cabeza a la izquierda';
    case 'turn_right': return 'Gira la cabeza a la derecha';
    case 'smile': return 'Sonrie';
  }
}

export function getChallengeIcon(type: ChallengeType): string {
  switch (type) {
    case 'blink': return '👁️';
    case 'turn_left': return '👈';
    case 'turn_right': return '👉';
    case 'smile': return '😊';
  }
}

// ── UTILIDADES ─────────────────────────────────────────────

export function distance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function cosineDistance(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - Math.max(-1, Math.min(1, similarity));
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

// ── EMBEDDING GENERATION (face-api.js en navegador) ─────────

export async function generateEmbedding(input: HTMLVideoElement | HTMLCanvasElement): Promise<number[] | null> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    if (detection.detection.score < 0.5) return null;

    const descriptor = detection.descriptor as Float32Array;
    const embedding: number[] = Array.from(descriptor);

    const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    return embedding;
  } catch {
    return null;
  }
}

export async function generateAverageEmbedding(inputs: (HTMLVideoElement | HTMLCanvasElement)[]): Promise<number[] | null> {
  const embeddings: number[][] = [];
  for (const input of inputs) {
    const emb = await generateEmbedding(input);
    if (emb) embeddings.push(emb);
  }
  if (embeddings.length === 0) return null;

  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
  }
  const norm = Math.sqrt(avg.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      avg[i] /= norm;
    }
  }
  return avg;
}

// ── FACE REGISTER (frontal + izquierda + derecha) ───────────

export async function registerFace(
  userId: number,
  photos: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const embeddings: number[][] = [];

    for (const [angle, dataUrl] of Object.entries(photos)) {
      if (!dataUrl) continue;
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const emb = await generateEmbedding(canvas);
      if (emb) embeddings.push(emb);
    }

    if (embeddings.length < 2) {
      return { ok: false, error: 'No se detecto rostro en al menos 2 de las 3 fotos' };
    }

    await supabase.from('rostros').delete().eq('usuario_id', userId);

    for (const emb of embeddings) {
      await supabase.from('rostros').insert({
        usuario_id: userId,
        embedding: emb,
        foto_preview: null,
      });
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Error registrando rostro' };
  }
}

// ── FACE LOGIN (comparar con todos los embeddings) ──────────

const UMBRAL = 0.30;
const GAP_MINIMO = 0.06;
const MIN_MATCHES_POR_USUARIO = 2;

export async function loginByFace(
  photos: Record<string, string>
): Promise<{ ok: boolean; usuario_id?: number; nombre?: string; email?: string; error?: string }> {
  try {
    const embeddings: number[][] = [];

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

      const emb = await generateEmbedding(canvas);
      if (emb) embeddings.push(emb);
    }

    if (embeddings.length === 0) {
      return { ok: false, error: 'No se detecto ningun rostro' };
    }

    const { data: rostros } = await supabase
      .from('rostros')
      .select('usuario_id, embedding');

    if (!rostros || rostros.length === 0) {
      return { ok: false, error: 'No hay usuarios con rostro registrado' };
    }

    const userMatches: Record<number, number[]> = {};

    for (let eIdx = 0; eIdx < embeddings.length; eIdx++) {
      for (let rIdx = 0; rIdx < rostros.length; rIdx++) {
        const dist = cosineDistance(embeddings[eIdx], rostros[rIdx].embedding);
        const uid = rostros[rIdx].usuario_id;
        if (dist <= UMBRAL) {
          if (!userMatches[uid]) userMatches[uid] = [];
          userMatches[uid].push(dist);
        }
      }
    }

    const eligibleUsers = Object.entries(userMatches)
      .filter(([, dists]) => dists.length >= MIN_MATCHES_POR_USUARIO)
      .map(([uid, dists]) => ({
        userId: Number(uid),
        bestDist: Math.min(...dists),
        matchCount: dists.length,
      }));

    if (eligibleUsers.length === 0) {
      return { ok: false, error: 'Rostro no reconocido' };
    }

    eligibleUsers.sort((a, b) => a.bestDist - b.bestDist);

    const best = eligibleUsers[0];
    const second = eligibleUsers.length > 1 ? eligibleUsers[1] : null;

    if (second && (second.bestDist - best.bestDist) < GAP_MINIMO) {
      return { ok: false, error: 'Rostro ambiguo, intente de nuevo' };
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre, email')
      .eq('id', best.userId)
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

export async function hasAnyFaceRegistered(): Promise<boolean> {
  const { data } = await supabase
    .from('rostros')
    .select('id')
    .limit(1);
  return (data && data.length > 0) || false;
}
