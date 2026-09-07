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

export function areModelsReady(): boolean {
  return modelsLoaded;
}

// ── DETECCION + MULTI-FACE ──────────────────────────────

export interface DetectionResult {
  detected: boolean;
  count: number;
  box: { x: number; y: number; width: number; height: number } | null;
  landmarks: any;
  score: number;
}

export async function detectFace(input: HTMLVideoElement | HTMLCanvasElement): Promise<DetectionResult> {
  try {
    const inputW = (input as HTMLVideoElement).videoWidth || input.clientWidth;
    const inputH = (input as HTMLVideoElement).videoHeight || input.clientHeight;
    const inputSize = Math.min(inputW, inputH) > 500 ? 320 : 160;

    const detections = await (faceapi as any)
      .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.2 }))
      .withFaceLandmarks();

    if (!detections || detections.length === 0) {
      return { detected: false, count: 0, box: null, landmarks: null, score: 0 };
    }

    if (detections.length > 1) {
      return { detected: false, count: detections.length, box: null, landmarks: null, score: 0 };
    }

    const det = detections[0];
    return {
      detected: true,
      count: 1,
      box: det.detection.box,
      landmarks: det.landmarks,
      score: det.detection.score,
    };
  } catch {
    return { detected: false, count: 0, box: null, landmarks: null, score: 0 };
  }
}

// ── QUALITY ANALYSIS ────────────────────────────────────

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

    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.2 }))
      .withFaceLandmarks();

    if (!detection) {
      return { centered: false, angleOk: false, detected: false, message: 'Coloque su rostro frente a la camara', score: 0 };
    }

    const landmarks = detection.landmarks;
    const box = detection.detection.box;
    const centerX = box.x + box.width / 2;
    const normX = centerX / inputW;
    const centered = Math.abs(normX - 0.5) < 0.25;

    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const eyeSpan = rightEye[3].x - leftEye[0].x;
    const noseRelative = (nose[3].x - leftEye[0].x) / eyeSpan;
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
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks();

    if (!detection) return { ok: false, yaw: 0 };

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const eyeSpan = rightEye[3].x - leftEye[0].x;
    const noseRelative = (nose[3].x - leftEye[0].x) / eyeSpan;
    const yaw = (noseRelative - 0.5) * 120;

    if (targetAngle === 'frontal') return { ok: Math.abs(yaw) < 8, yaw };
    if (targetAngle === 'izquierda') return { ok: yaw > 12 && yaw < 45, yaw };
    return { ok: yaw < -12 && yaw > -45, yaw };
  } catch {
    return { ok: false, yaw: 0 };
  }
}

// ── EMBEDDING (face-api.js client-side) ─────────────────

function captureFromVideo(video: HTMLVideoElement): Float32Array | null {
  try {
    const detection = (faceapi as any).detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })
    );
    if (!detection) return null;
    return detection.descriptor;
  } catch {
    return null;
  }
}

function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  const len = embeddings[0].length;
  const avg = new Float32Array(len);
  for (const emb of embeddings) {
    for (let i = 0; i < len; i++) avg[i] += emb[i];
  }
  for (let i = 0; i < len; i++) avg[i] /= embeddings.length;
  return avg;
}

// ── SAVE / REGISTER (client-side → Supabase) ───────────

export async function saveFaceEmbedding(
  userId: number,
  embedding: Float32Array
): Promise<{ success: boolean; error?: string }> {
  const { data: existing } = await supabase
    .from('rostros')
    .select('id')
    .eq('usuario_id', userId)
    .limit(1);

  const metadata = {
    dimensions: embedding.length,
    version: '1.0',
    model: 'face_recognition_68',
    capturedAt: new Date().toISOString(),
    deviceInfo: navigator.userAgent.substring(0, 100),
  };

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('rostros')
      .update({ embedding: Array.from(embedding), metadata, updated_at: new Date().toISOString() })
      .eq('usuario_id', userId);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase.from('rostros').insert({
      usuario_id: userId,
      embedding: Array.from(embedding),
      metadata,
    });
    if (error) return { success: false, error: error.message };
  }
  return { success: true };
}

export async function registerFaceFromPhotos(
  userId: number,
  photos: { frontal?: string; izquierda?: string; derecha?: string }
): Promise<{ success: boolean; error?: string; validAngles?: number }> {
  const embeddings: Float32Array[] = [];

  for (const photoData of Object.values(photos)) {
    if (!photoData) continue;
    const img = new Image();
    img.src = photoData;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });

    try {
      const detection = await (faceapi as any)
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (detection) embeddings.push(detection.descriptor);
    } catch {}
  }

  if (embeddings.length < 2) {
    return { success: false, error: 'No se detecto rostro en al menos 2 fotos. Intenta con mejor iluminacion.' };
  }

  const avg = averageEmbeddings(embeddings);
  const result = await saveFaceEmbedding(userId, avg);
  return { ...result, validAngles: embeddings.length };
}

// ── MATCH / LOGIN (client-side) ─────────────────────────

export async function matchFaceFromVideo(
  video: HTMLVideoElement
): Promise<{ userId: number; distance: number; nombre?: string } | null> {
  const liveEmbedding = captureFromVideo(video);
  if (!liveEmbedding) return null;

  const { data: rostros } = await supabase
    .from('rostros')
    .select('usuario_id, embedding');

  if (!rostros || rostros.length === 0) return null;

  const THRESHOLD = 0.60;
  let bestMatch: { userId: number; distance: number } | null = null;

  for (const r of rostros) {
    const stored = new Float32Array(r.embedding as number[]);
    let sum = 0;
    for (let i = 0; i < liveEmbedding.length; i++) {
      const d = liveEmbedding[i] - stored[i];
      sum += d * d;
    }
    const dist = Math.sqrt(sum);
    if (dist < THRESHOLD && (!bestMatch || dist < bestMatch.distance)) {
      bestMatch = { userId: r.usuario_id, distance: dist };
    }
  }

  return bestMatch;
}

export async function matchFaceFromPhotos(
  photos: { frontal?: string; izquierda?: string; derecha?: string }
): Promise<{ userId: number; distance: number; nombre?: string } | null> {
  const embeddings: Float32Array[] = [];

  for (const photoData of Object.values(photos)) {
    if (!photoData) continue;
    const img = new Image();
    img.src = photoData;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });

    try {
      const detection = await (faceapi as any)
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (detection) embeddings.push(detection.descriptor);
    } catch {}
  }

  if (embeddings.length === 0) return null;

  const avg = averageEmbeddings(embeddings);

  const { data: rostros } = await supabase
    .from('rostros')
    .select('usuario_id, embedding');

  if (!rostros || rostros.length === 0) return null;

  const THRESHOLD = 0.60;
  let bestMatch: { userId: number; distance: number } | null = null;

  for (const r of rostros) {
    const stored = new Float32Array(r.embedding as number[]);
    let sum = 0;
    for (let i = 0; i < avg.length; i++) {
      const d = avg[i] - stored[i];
      sum += d * d;
    }
    const dist = Math.sqrt(sum);
    if (dist < THRESHOLD && (!bestMatch || dist < bestMatch.distance)) {
      bestMatch = { userId: r.usuario_id, distance: dist };
    }
  }

  return bestMatch;
}

// ── UTILITIES ───────────────────────────────────────────

export async function hasFaceRegistered(userId: number): Promise<boolean> {
  const { data } = await supabase
    .from('rostros')
    .select('id')
    .eq('usuario_id', userId)
    .limit(1);
  return (data && data.length > 0) || false;
}

export async function anyFaceRegistered(): Promise<boolean> {
  const { data } = await supabase
    .from('rostros')
    .select('id')
    .limit(1);
  return (data && data.length > 0) || false;
}

export async function deleteFaceEmbeddings(userId: number): Promise<void> {
  await supabase.from('rostros').delete().eq('usuario_id', userId);
}
