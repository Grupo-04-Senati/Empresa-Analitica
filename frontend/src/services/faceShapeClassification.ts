/**
 * Face shape classification from 68 landmarks (face-api.js / dlib layout).
 *
 * Landmarks 68 layout:
 *   0-16:  Jaw line (0=right ear, 8=chin, 16=left ear)
 *  17-21:  Right eyebrow (17=outer, 21=inner)
 *  22-26:  Left eyebrow (22=inner, 26=outer)
 *  27-30:  Nose bridge
 *  31-35:  Nose bottom
 *  36-41:  Right eye
 *  42-47:  Left eye
 *  48-59:  Outer lips
 *  60-67:  Inner lips
 */

export interface FaceLandmark {
  x: number;
  y: number;
}

export interface FaceProportions {
  jawWidth: number;
  jawAngle: number;
  cheekboneWidth: number;
  foreheadWidth: number;
  faceLength: number;
  ratios: {
    jawToLength: number;
    cheekToLength: number;
    foreheadToLength: number;
    foreheadToCheek: number;
    cheekToJaw: number;
    foreheadToJaw: number;
  };
}

export type FaceShape =
  | 'ovalado'
  | 'redondo'
  | 'cuadrado'
  | 'alargado'
  | 'corazon'
  | 'diamante'
  | 'triangular';

function dist(a: FaceLandmark, b: FaceLandmark): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function midpoint(a: FaceLandmark, b: FaceLandmark): FaceLandmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function angle(a: FaceLandmark, vertex: FaceLandmark, b: FaceLandmark): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot / (mag1 * mag2)))) * (180 / Math.PI);
}

/**
 * Extract structural proportions from 68 landmarks.
 */
export function extractFaceProportions(landmarks: FaceLandmark[]): FaceProportions {
  const jawWidth = dist(landmarks[2], landmarks[14]);

  const jawAngle = angle(landmarks[5], landmarks[8], landmarks[11]);

  const cheekboneWidth = dist(landmarks[1], landmarks[15]);

  const foreheadWidth = dist(landmarks[17], landmarks[26]);

  const eyebrowMid = midpoint(landmarks[21], landmarks[22]);
  const chin = landmarks[8];
  const faceLength = dist(eyebrowMid, chin);

  const norm = faceLength || 1;

  const ratios = {
    jawToLength: jawWidth / norm,
    cheekToLength: cheekboneWidth / norm,
    foreheadToLength: foreheadWidth / norm,
    foreheadToCheek: foreheadWidth / (cheekboneWidth || 1),
    cheekToJaw: cheekboneWidth / (jawWidth || 1),
    foreheadToJaw: foreheadWidth / (jawWidth || 1),
  };

  return { jawWidth, jawAngle, cheekboneWidth, foreheadWidth, faceLength, ratios };
}

/**
 * Classify face shape based on normalized ratios.
 *
 * Classification logic (all ratios are normalized to face length):
 *
 * ovalado:   faceLength > jawWidth, forehead ≈ cheekbones, jaw narrower, angle >120
 * redondo:   faceLength ≈ jawWidth, all widths similar
 * cuadrado:  faceLength ≈ jawWidth, forehead ≈ cheekbones ≈ jaw, strong jaw angle
 * alargado:  faceLength >> jawWidth, all widths similar
 * corazon:   forehead > cheekbones > jaw, narrow jaw
 * diamante:  cheekbones > forehead ≈ jaw, narrow forehead and jaw
 * triangular: jaw > forehead, wide jaw narrowing up
 */
export function classifyFaceShape(proportions: FaceProportions): FaceShape {
  const { ratios, jawAngle } = proportions;
  const { jawToLength, cheekToLength, foreheadToLength, foreheadToCheek, cheekToJaw, foreheadToJaw } = ratios;

  const score: Record<FaceShape, number> = {
    ovalado: 0,
    redondo: 0,
    cuadrado: 0,
    alargado: 0,
    corazon: 0,
    diamante: 0,
    triangular: 0,
  };

  // ALARGADO: face is much longer than wide
  if (jawToLength < 0.60 && cheekToLength < 0.70 && foreheadToLength < 0.70) {
    score.alargado += 3;
  }
  if (jawToLength < 0.55) score.alargado += 1;

  // REDONDO: face length ≈ face width, everything similar
  if (jawToLength > 0.80 && jawToLength < 0.95 &&
      cheekToLength > 0.80 && cheekToLength < 0.95 &&
      foreheadToLength > 0.75 && foreheadToLength < 0.90) {
    score.redondo += 3;
  }
  if (jawAngle > 130 && jawToLength > 0.75) score.redondo += 1;

  // CUADRADO: face length ≈ width, strong jaw, similar forehead/cheek/jaw
  if (jawToLength > 0.75 && jawToLength < 0.90 &&
      cheekToLength > 0.80 && cheekToLength < 0.95 &&
      foreheadToLength > 0.75 && foreheadToLength < 0.90) {
    score.cuadrado += 2;
  }
  if (jawAngle > 120 && jawAngle < 140 &&
      foreheadToJaw > 0.85 && foreheadToJaw < 1.15) {
    score.cuadrado += 2;
  }

  // OVALADO: forehead slightly wider than jaw, face longer than wide, jaw rounded
  if (foreheadToJaw > 1.0 && foreheadToJaw < 1.2 &&
      jawToLength > 0.60 && jawToLength < 0.80 &&
      jawAngle > 115) {
    score.ovalado += 3;
  }
  if (foreheadToCheek > 0.90 && foreheadToCheek < 1.10 &&
      cheekToJaw > 1.05) {
    score.ovalado += 1;
  }

  // CORAZON: forehead > cheekbones > jaw, pointed chin
  if (foreheadToCheek > 1.05 && cheekToJaw > 1.10) {
    score.corazon += 2;
  }
  if (foreheadToLength > 0.70 && jawToLength < 0.65) {
    score.corazon += 2;
  }
  if (jawAngle < 115 && jawToLength < 0.70) {
    score.corazon += 1;
  }

  // DIAMANTE: cheekbones widest, narrow forehead and jaw
  if (cheekToLength > foreheadToLength && cheekToJaw > 1.05) {
    score.diamante += 2;
  }
  if (foreheadToCheek < 0.95 && cheekToJaw > 1.10) {
    score.diamante += 2;
  }
  if (foreheadToJaw > 0.85 && foreheadToJaw < 1.05) {
    score.diamante += 1;
  }

  // TRIANGULAR: jaw wider than forehead
  if (foreheadToJaw < 0.95) {
    score.triangular += 2;
  }
  if (jawToLength > 0.80 && foreheadToLength < 0.70) {
    score.triangular += 2;
  }
  if (cheekToJaw < 1.0) {
    score.triangular += 1;
  }

  let best: FaceShape = 'ovalado';
  let bestScore = -1;
  for (const [shape, s] of Object.entries(score) as [FaceShape, number][]) {
    if (s > bestScore) {
      bestScore = s;
      best = shape;
    }
  }

  return best;
}

/**
 * Full pipeline: landmarks → proportions → shape classification.
 */
export function classifyFromLandmarks(landmarks: FaceLandmark[]): {
  shape: FaceShape;
  proportions: FaceProportions;
} {
  const proportions = extractFaceProportions(landmarks);
  const shape = classifyFaceShape(proportions);
  return { shape, proportions };
}
