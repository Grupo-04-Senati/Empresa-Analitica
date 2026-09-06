import * as faceapi from 'face-api.js';
import { supabase } from './supabase';

const MODEL_URL = '/models';

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) return modelsLoading;

  modelsLoading = (async () => {
    const load = async (net: any, name: string) => {
      const start = Date.now();
      await net.loadFromUri(MODEL_URL);
      console.log(`[face] ${name} cargado en ${Date.now() - start}ms`);
    };
    await load(faceapi.nets.tinyFaceDetector, 'tinyFaceDetector');
    await load(faceapi.nets.faceLandmark68Net, 'faceLandmark68');
    await load(faceapi.nets.faceRecognitionNet, 'faceRecognition');
    modelsLoaded = true;
    modelsLoading = null;
  })();

  return modelsLoading;
}

export interface DetectionResult {
  detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<faceapi.WithFaceDetection<{}>>> | null;
  box: { x: number; y: number; width: number; height: number } | null;
  score: number;
}

export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<DetectionResult> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return { detection: null, box: null, score: 0 };
    }

    return {
      detection,
      box: detection.detection.box,
      score: detection.detection.score,
    };
  } catch {
    return { detection: null, box: null, score: 0 };
  }
}

export async function detectFaceQuick(
  input: HTMLVideoElement | HTMLCanvasElement
): Promise<{ detected: boolean; box: { x: number; y: number; width: number; height: number } | null; score: number }> {
  try {
    const detection = await (faceapi as any)
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.35 }));

    if (!detection || !detection.detection) {
      return { detected: false, box: null, score: 0 };
    }
    return {
      detected: true,
      box: detection.detection.box,
      score: detection.detection.score,
    };
  } catch {
    return { detected: false, box: null, score: 0 };
  }
}

export async function captureEmbedding(
  video: HTMLVideoElement
): Promise<Float32Array | null> {
  const result = await detectFace(video);
  if (!result.detection) return null;
  return result.detection.descriptor;
}

export async function captureMultipleEmbeddings(
  video: HTMLVideoElement,
  count: number = 3,
  delayMs: number = 800
): Promise<Float32Array[]> {
  const embeddings: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const emb = await captureEmbedding(video);
    if (emb) {
      embeddings.push(emb);
    }
  }
  return embeddings;
}

export function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  const len = embeddings[0].length;
  const avg = new Float32Array(len);
  for (const emb of embeddings) {
    for (let i = 0; i < len; i++) {
      avg[i] += emb[i];
    }
  }
  for (let i = 0; i < len; i++) {
    avg[i] /= embeddings.length;
  }
  return avg;
}

export function distance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

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
      .update({
        embedding: Array.from(embedding),
        metadata,
        updated_at: new Date().toISOString(),
      })
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

export async function hasFaceRegistered(userId: number): Promise<boolean> {
  const { data } = await supabase
    .from('rostros')
    .select('id')
    .eq('usuario_id', userId)
    .limit(1);
  return (data && data.length > 0) || false;
}

export async function matchFaceFromCamera(
  video: HTMLVideoElement
): Promise<{ userId: number; distance: number } | null> {
  const liveEmbedding = await captureEmbedding(video);
  if (!liveEmbedding) return null;

  const { data: rostros } = await supabase
    .from('rostros')
    .select('usuario_id, embedding');

  if (!rostros || rostros.length === 0) return null;

  let bestMatch: { userId: number; distance: number } | null = null;
  const THRESHOLD = 0.60;

  for (const rostro of rostros) {
    const stored = new Float32Array(rostro.embedding as number[]);
    const dist = distance(liveEmbedding, stored);
    if (dist < THRESHOLD) {
      if (!bestMatch || dist < bestMatch.distance) {
        bestMatch = { userId: rostro.usuario_id, distance: dist };
      }
    }
  }

  return bestMatch;
}

export async function matchFaceMultiCapture(
  video: HTMLVideoElement
): Promise<{ userId: number; distance: number } | null> {
  const embeddings = await captureMultipleEmbeddings(video, 3, 600);
  if (embeddings.length === 0) return null;

  const avgEmbedding = averageEmbeddings(embeddings);

  const { data: rostros } = await supabase
    .from('rostros')
    .select('usuario_id, embedding');

  if (!rostros || rostros.length === 0) return null;

  let bestMatch: { userId: number; distance: number } | null = null;
  const THRESHOLD = 0.60;

  for (const rostro of rostros) {
    const stored = new Float32Array(rostro.embedding as number[]);
    const dist = distance(avgEmbedding, stored);
    if (dist < THRESHOLD) {
      if (!bestMatch || dist < bestMatch.distance) {
        bestMatch = { userId: rostro.usuario_id, distance: dist };
      }
    }
  }

  return bestMatch;
}

export async function deleteFaceEmbeddings(userId: number): Promise<void> {
  await supabase.from('rostros').delete().eq('usuario_id', userId);
}
