/**
 * MediaPipe Face Landmarker — 478 landmarks with depth (x, y, z).
 * Replaces the 68-point face-api.js system.
 *
 * 478 landmarks layout:
 *   0-467: Face mesh surface points (x, y normalized [0,1], z depth)
 *   468-477: Iris landmarks (5 per eye)
 *
 * The z coordinate encodes depth relative to the face center.
 * Normalized to the inter-ocular distance for scale invariance.
 */

import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let faceLandmarker: FaceLandmarker | null = null;
let loadingPromise: Promise<FaceLandmarker> | null = null;

export interface Landmark478 {
  x: number;
  y: number;
  z: number;
}

export interface FaceScanResult {
  landmarks: Landmark478[];
  blendshapes: { name: string; score: number }[];
  faceWidth: number;
  faceHeight: number;
  confidence: number;
  timestamp: number;
}

export interface TemporalFaceData {
  frames: FaceScanResult[];
  avgLandmarks: Landmark478[];
  avgBlendshapes: { name: string; score: number }[];
  stability: number;
  totalFrames: number;
}

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log('[MediaPipe] Loading FaceLandmarker...');
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
    });
    console.log('[MediaPipe] FaceLandmarker loaded');
    faceLandmarker = landmarker;
    return landmarker;
  })();

  return loadingPromise;
}

export function isLoaded(): boolean {
  return faceLandmarker !== null;
}

/**
 * Detect 478 landmarks from a video frame.
 */
export function detectFrame(
  video: HTMLVideoElement,
  timestamp: number
): FaceScanResult | null {
  if (!faceLandmarker) return null;

  try {
    const result: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, timestamp);
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;

    const faceLandmarks = result.faceLandmarks[0];
    const blendshapes = (result.faceBlendshapes as any)?.[0]?.categories?.map((bs: any) => ({
      name: bs.categoryName,
      score: bs.score,
    })) || [];

    const landmarks: Landmark478[] = faceLandmarks.map(l => ({
      x: l.x,
      y: l.y,
      z: l.z,
    }));

    // Calculate face dimensions from landmarks
    const leftCheek = landmarks[234]; // left cheek
    const rightCheek = landmarks[454]; // right cheek
    const forehead = landmarks[10]; // top of forehead
    const chin = landmarks[152]; // bottom of chin

    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    const faceHeight = Math.abs(chin.y - forehead.y);

    return {
      landmarks,
      blendshapes,
      faceWidth,
      faceHeight,
      confidence: 1.0,
      timestamp,
    };
  } catch (e) {
    console.error('[MediaPipe] Detection error:', e);
    return null;
  }
}

/**
 * Normalize 478 landmarks to be invariant to distance and position.
 * Uses nose tip (landmark 1) as origin and inter-ocular distance as scale.
 */
export function normalizeLandmarks478(landmarks: Landmark478[]): Landmark478[] {
  if (landmarks.length < 478) return landmarks;

  // Nose tip is landmark 1
  const noseTip = landmarks[1];

  // Inter-ocular distance (landmarks 33 and 263 are eye centers)
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const interOcular = Math.sqrt(
    (rightEye.x - leftEye.x) ** 2 +
    (rightEye.y - leftEye.y) ** 2 +
    (rightEye.z - leftEye.z) ** 2
  ) || 1;

  // Normalize: translate to nose tip, scale by inter-ocular distance
  return landmarks.map(l => ({
    x: (l.x - noseTip.x) / interOcular,
    y: (l.y - noseTip.y) / interOcular,
    z: (l.z - noseTip.z) / interOcular,
  }));
}

/**
 * Compare two sets of 478 normalized landmarks.
 * Returns a similarity score [0, 1] where 1 = identical.
 */
export function compareLandmarks478(
  a: Landmark478[],
  b: Landmark478[]
): number {
  if (a.length !== b.length || a.length < 478) return 0;

  // Weighted regions — some areas are more distinctive than others
  const weights = getLandmarkWeights();

  let weightedDist = 0;
  let totalWeight = 0;

  for (let i = 0; i < 478; i++) {
    const w = weights[i] || 1.0;
    const dx = a[i].x - b[i].x;
    const dy = a[i].y - b[i].y;
    const dz = a[i].z - b[i].z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    weightedDist += dist * w;
    totalWeight += w;
  }

  const avgDist = weightedDist / totalWeight;

  // Convert distance to similarity score
  // Distance of 0 = identical (score 1.0)
  // Distance of 0.5+ = very different (score ~0)
  const similarity = Math.max(0, 1 - avgDist * 2.5);
  return Math.round(similarity * 1000) / 1000;
}

/**
 * Weight map for landmark comparison.
 * Higher weight = more distinctive for identification.
 */
function getLandmarkWeights(): number[] {
  const weights = new Array(478).fill(1.0);

  // Eye region (more distinctive) — indices 33, 133, 159, 145, 362, 263, 386, 374
  for (const i of [33, 133, 159, 145, 362, 263, 386, 374, 7, 246, 161, 160, 158, 157, 173, 398, 384, 385, 387, 388, 466, 390, 249, 263, 466, 414]) {
    if (i < 478) weights[i] = 2.0;
  }

  // Nose region (very distinctive) — bridge and tip
  for (const i of [1, 2, 98, 327, 168, 6, 197, 195, 5, 4, 19, 94, 2]) {
    if (i < 478) weights[i] = 2.5;
  }

  // Lip contour (distinctive)
  for (const i of [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]) {
    if (i < 478) weights[i] = 1.8;
  }

  // Jaw contour (distinctive)
  for (const i of [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 378, 400, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 333, 298, 301, 368]) {
    if (i < 478) weights[i] = 2.0;
  }

  // Forehead (less distinctive)
  for (const i of [10, 151, 9, 8, 107, 66, 105, 63, 70, 336, 296, 334, 293, 300, 283, 332, 297]) {
    if (i < 478) weights[i] = 0.8;
  }

  // Cheeks (moderate)
  for (const i of [50, 101, 118, 119, 120, 121, 47, 126, 217, 174, 188, 245, 44, 236, 196, 171, 175, 152, 396, 428, 401, 369, 430, 449, 355, 278, 437, 456, 426, 423]) {
    if (i < 478) weights[i] = 1.3;
  }

  return weights;
}

/**
 * Collect multiple frames over time for a temporal face scan.
 * Returns averaged, normalized landmarks and stability score.
 */
export function buildTemporalSignature(frames: FaceScanResult[]): TemporalFaceData | null {
  if (frames.length < 3) return null;

  // Filter frames with valid landmarks
  const validFrames = frames.filter(f => f.landmarks.length >= 478);
  if (validFrames.length < 3) return null;

  // Normalize each frame's landmarks
  const normalizedFrames = validFrames.map(f => normalizeLandmarks478(f.landmarks));

  // Average landmarks across frames
  const avgLandmarks: Landmark478[] = [];
  for (let i = 0; i < 478; i++) {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const frame of normalizedFrames) {
      sumX += frame[i].x;
      sumY += frame[i].y;
      sumZ += frame[i].z;
    }
    const n = normalizedFrames.length;
    avgLandmarks.push({ x: sumX / n, y: sumY / n, z: sumZ / n });
  }

  // Average blendshapes
  const allBS = new Map<string, number[]>();
  for (const frame of validFrames) {
    for (const bs of frame.blendshapes) {
      if (!allBS.has(bs.name)) allBS.set(bs.name, []);
      allBS.get(bs.name)!.push(bs.score);
    }
  }
  const avgBlendshapes = Array.from(allBS.entries()).map(([name, scores]) => ({
    name,
    score: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));

  // Calculate stability (how consistent are the landmarks across frames)
  let totalVariance = 0;
  for (let i = 0; i < 478; i++) {
    const xs = normalizedFrames.map(f => f[i].x);
    const ys = normalizedFrames.map(f => f[i].y);
    const zs = normalizedFrames.map(f => f[i].z);
    const meanX = avgLandmarks[i].x;
    const meanY = avgLandmarks[i].y;
    const meanZ = avgLandmarks[i].z;
    const varX = xs.reduce((s, x) => s + (x - meanX) ** 2, 0) / xs.length;
    const varY = ys.reduce((s, y) => s + (y - meanY) ** 2, 0) / ys.length;
    const varZ = zs.reduce((s, z) => s + (z - meanZ) ** 2, 0) / zs.length;
    totalVariance += varX + varY + varZ;
  }
  const avgVariance = totalVariance / 478;
  const stability = Math.max(0, Math.min(1, 1 - avgVariance * 100));

  return {
    frames: validFrames,
    avgLandmarks,
    avgBlendshapes,
    stability,
    totalFrames: validFrames.length,
  };
}

/**
 * Compress 478 landmarks to a compact numeric array for storage.
 * Returns [x0,y0,z0, x1,y1,z1, ...] flattened (1434 values).
 */
export function landmarksToFlatArray(landmarks: Landmark478[]): number[] {
  const arr: number[] = [];
  for (const l of landmarks) {
    arr.push(Math.round(l.x * 10000) / 10000);
    arr.push(Math.round(l.y * 10000) / 10000);
    arr.push(Math.round(l.z * 10000) / 10000);
  }
  return arr;
}

/**
 * Reconstruct Landmark478[] from flat array.
 */
export function flatArrayToLandmarks(arr: number[]): Landmark478[] {
  const landmarks: Landmark478[] = [];
  for (let i = 0; i < arr.length - 2; i += 3) {
    landmarks.push({ x: arr[i], y: arr[i + 1], z: arr[i + 2] });
  }
  return landmarks;
}

/**
 * Generate a compact face signature from averaged landmarks.
 * This is what gets stored in the database for comparison.
 */
export function generateFaceSignature478(avgLandmarks: Landmark478[]): number[] {
  // Key landmark indices for a compact signature
  // These cover the most distinctive face regions
  const keyIndices = [
    // Nose
    1, 2, 3, 4, 5, 6, 168, 197, 195, 5, 4,
    // Left eye
    33, 133, 159, 145, 7, 163, 144, 146, 153, 154, 155, 133,
    // Right eye
    362, 263, 386, 374, 249, 373, 380, 381, 382, 362,
    // Lips outer
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0,
    // Lips inner
    78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 42, 38,
    // Jaw
    234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 378, 400, 379, 365, 397, 288, 361, 323, 454,
    // Forehead
    10, 151, 9, 8, 107, 66, 105, 63, 70, 336, 296, 334,
    // Cheeks
    50, 101, 118, 119, 120, 121, 47, 126, 217, 174, 188, 245, 44, 236,
  ];

  // Deduplicate
  const uniqueIndices = [...new Set(keyIndices)].filter(i => i < avgLandmarks.length);

  const signature: number[] = [];
  for (const i of uniqueIndices) {
    signature.push(avgLandmarks[i].x, avgLandmarks[i].y, avgLandmarks[i].z);
  }
  return signature;
}

/**
 * Compare two face signatures (compact arrays).
 * Returns similarity [0, 1].
 */
export function compareSignatures478(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let sumSqDist = 0;
  for (let i = 0; i < a.length; i++) {
    sumSqDist += (a[i] - b[i]) ** 2;
  }
  const rmsDist = Math.sqrt(sumSqDist / a.length);

  // Convert to similarity
  return Math.max(0, Math.min(1, 1 - rmsDist * 5));
}

export function dispose(): void {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  loadingPromise = null;
}
