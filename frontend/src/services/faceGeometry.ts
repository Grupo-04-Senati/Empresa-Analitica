/**
 * faceGeometry.ts
 * 
 * Sistema de reconocimiento facial basado en PLANO CARTESIANO.
 * 
 * CONCEPTO CLAVE: Equivalencia por Ratios
 * Cuando una persona se aleja, los puntos (x,y) se achican proporcionalmente.
 * Pero los RATIOS entre distancias y los ANGULOS entre puntos se mantienen.
 * 
 * Ejemplo: Si ojos-nariz / ojos-boca = 0.45 estando cerca,
 *          sigue siendo ~0.45 estando lejos.
 *          Esa es la EQUIVALENCIA ÚNICA de ese rostro.
 * 
 * Cada rostro humano tiene ratios únicos que lo distinguen.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface FaceSignature {
  ratios: number[];
  angles: number[];
  vectors: number[];
  uniqueHash: string;
}

// ── FUNCIONES MATEMÁTICAS BÁSICAS ──────────────────────────

export function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function angleBetween(a: Point2D, vertex: Point2D, b: Point2D): number {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

export function normalizePoints(points: Point2D[]): Point2D[] {
  if (points.length === 0) return [];
  const centerX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const centerY = points.reduce((s, p) => s + p.y, 0) / points.length;
  const maxDist = Math.max(...points.map(p => distance(p, { x: centerX, y: centerY })));
  if (maxDist === 0) return points.map(() => ({ x: 0, y: 0 }));
  return points.map(p => ({
    x: (p.x - centerX) / maxDist,
    y: (p.y - centerY) / maxDist,
  }));
}

// ── EXTRAER 68 PUNTOS A COORDENADAS (x, y) ─────────────────

export function extractCoordinates(landmarks: any[]): Point2D[] {
  return landmarks.map((p: any) => ({ x: p.x, y: p.y }));
}

// ── CALCULAR RATIOS (invariantes a distancia) ──────────────

export function calculateRatios(pts: Point2D[]): number[] {
  if (pts.length < 68) return [];

  const leftEye = pts[36];
  const rightEye = pts[45];
  const noseBridge = pts[27];
  const noseTip = pts[30];
  const chin = pts[8];
  const leftMouth = pts[48];
  const rightMouth = pts[54];
  const leftJaw = pts[0];
  const rightJaw = pts[16];
  const forehead = pts[27];
  const leftBrow = pts[19];
  const rightBrow = pts[24];

  const interEye = distance(leftEye, rightEye);
  const noseLength = distance(noseBridge, noseTip);
  const noseToChin = distance(noseTip, chin);
  const faceHeight = distance(forehead, chin);
  const faceWidth = distance(leftJaw, rightJaw);
  const mouthWidth = distance(leftMouth, rightMouth);
  const browDist = distance(leftBrow, rightBrow);
  const eyeToMouth = distance(midpoint(leftEye, rightEye), midpoint(leftMouth, rightMouth));
  const noseToMouth = distance(noseTip, midpoint(leftMouth, rightMouth));
  const leftEyeToJaw = distance(leftEye, leftJaw);
  const rightEyeToJaw = distance(rightEye, rightJaw);
  const upperFace = distance(midpoint(leftEye, rightEye), forehead);
  const lowerFace = distance(midpoint(leftMouth, rightMouth), chin);

  const ref = interEye || 1;

  return [
    interEye / faceWidth,
    noseLength / faceHeight,
    noseToChin / faceHeight,
    mouthWidth / faceWidth,
    mouthWidth / interEye,
    browDist / faceWidth,
    eyeToMouth / faceHeight,
    noseToMouth / noseLength,
    faceWidth / faceHeight,
    upperFace / faceHeight,
    lowerFace / faceHeight,
    (leftEyeToJaw + rightEyeToJaw) / (2 * faceWidth),
    noseLength / mouthWidth,
    interEye / browDist,
    noseToChin / noseLength,
  ];
}

// ── CALCULAR ÁNGULOS (invariantes a distancia) ─────────────

export function calculateAngles(pts: Point2D[]): number[] {
  if (pts.length < 68) return [];

  const leftEye = pts[36];
  const rightEye = pts[45];
  const noseBridge = pts[27];
  const noseTip = pts[30];
  const chin = pts[8];
  const leftMouth = pts[48];
  const rightMouth = pts[54];
  const forehead = pts[27];

  const eyeCenter = midpoint(leftEye, rightEye);
  const mouthCenter = midpoint(leftMouth, rightMouth);

  return [
    angleBetween(leftEye, noseBridge, rightEye),
    angleBetween(leftEye, noseTip, rightEye),
    angleBetween(leftEye, chin, rightEye),
    angleBetween(leftEye, mouthCenter, rightEye),
    angleBetween(leftEye, forehead, rightEye),
    angleBetween(noseBridge, noseTip, chin),
    angleBetween(leftEye, noseTip, leftMouth),
    angleBetween(rightEye, noseTip, rightMouth),
    angleBetween(noseBridge, noseTip, mouthCenter),
    angleBetween(leftEye, eyeCenter, noseTip),
    angleBetween(rightEye, eyeCenter, noseTip),
    angleBetween(leftMouth, chin, rightMouth),
  ];
}

// ── CALCULAR VECTORES DIRECCIONALES ────────────────────────

export function calculateVectors(pts: Point2D[]): number[] {
  if (pts.length < 68) return [];

  const leftEye = pts[36];
  const rightEye = pts[45];
  const noseTip = pts[30];
  const chin = pts[8];
  const leftMouth = pts[48];
  const rightMouth = pts[54];
  const noseBridge = pts[27];

  const eyeCenter = midpoint(leftEye, rightEye);
  const mouthCenter = midpoint(leftMouth, rightMouth);

  const eyeVec = { x: rightEye.x - leftEye.x, y: rightEye.y - leftEye.y };
  const faceVec = { x: chin.x - noseBridge.x, y: chin.y - noseBridge.y };
  const noseVec = { x: noseTip.x - eyeCenter.x, y: noseTip.y - eyeCenter.y };

  const mag = (v: Point2D) => Math.sqrt(v.x ** 2 + v.y ** 2) || 1;
  const normalize = (v: Point2D): Point2D => {
    const m = mag(v);
    return { x: v.x / m, y: v.y / m };
  };

  const eN = normalize(eyeVec);
  const fN = normalize(faceVec);
  const nN = normalize(noseVec);

  return [
    eN.x, eN.y,
    fN.x, fN.y,
    nN.x, nN.y,
    noseTip.x / (mag(eyeVec) || 1),
    noseTip.y / (mag(eyeVec) || 1),
    chin.x / (mag(faceVec) || 1),
    chin.y / (mag(faceVec) || 1),
  ];
}

// ── GENERAR FIRMA ÚNICA DEL ROSTRO ────────────────────────

export function generateFaceSignature(pts: Point2D[]): FaceSignature {
  const ratios = calculateRatios(pts);
  const angles = calculateAngles(pts);
  const vectors = calculateVectors(pts);

  const allValues = [...ratios, ...angles, ...vectors];
  const hash = allValues.map(v => v.toFixed(4)).join('|');

  return { ratios, angles, vectors, uniqueHash: hash };
}

// ── COMPARAR DOS FIRMAS (equivalencia) ─────────────────────

export function compareSignatures(a: FaceSignature, b: FaceSignature): number {
  if (a.ratios.length === 0 || b.ratios.length === 0) return 0;

  const ratioDist = a.ratios.reduce((sum, r, i) => {
    const diff = Math.abs(r - (b.ratios[i] || 0));
    return sum + diff * diff;
  }, 0) / a.ratios.length;

  const angleDist = a.angles.reduce((sum, r, i) => {
    const diff = Math.abs(r - (b.angles[i] || 0));
    return sum + diff * diff;
  }, 0) / a.angles.length;

  const vectorDist = a.vectors.reduce((sum, r, i) => {
    const diff = Math.abs(r - (b.vectors[i] || 0));
    return sum + diff * diff;
  }, 0) / a.vectors.length;

  const totalDist = Math.sqrt(ratioDist * 0.4 + angleDist * 0.3 + vectorDist * 0.3);

  return Math.max(0, 1 - totalDist * 5);
}

// ── NORMALIZACIÓN UNIVERSAL (invariante a distancia) ─────────
//
// D_io = distancia interocular (puntos 36 y 45)
// Para cada punto i:  x' = (x_i - x_nariz) / D_io
//                     y' = (y_i - y_nariz) / D_io
//
// Resultado: coordenadas relativas al plano facial.
// Si te alejas 2x, todos los valores se mantienen iguales.

export function normalizeLandmarksByNose(pts: Point2D[]): Point2D[] {
  if (pts.length < 68) return pts;

  const noseTip = pts[30];
  const leftEye = pts[36];
  const rightEye = pts[45];

  const dIo = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
  if (dIo === 0) return pts;

  return pts.map(p => ({
    x: (p.x - noseTip.x) / dIo,
    y: (p.y - noseTip.y) / dIo,
  }));
}

// ── COMPARACIÓN PONDERADA POR REGIONES ──────────────────────
//
// Pesos según estabilidad de la zona facial:
//   Nariz + Pómulos (27-35):  1.5  (estructura ósea rígida)
//   Contorno (0-16):          1.0  (morfología del rostro)
//   Ojos (36-47):             1.0  (distancia interocular estable)
//   Cejas (17-26):            0.8  (semi-estable)
//   Boca (48-67):             0.5  (inestable con expresiones)
//
// Distancia = sqrt( sum( w_i * ((x_A - x_B)^2 + (y_A - y_B)^2) ) )

const REGION_WEIGHTS: Record<number, number> = {};

// Contorno facial (mandíbula + pómulos): 0-16
for (let i = 0; i <= 16; i++) REGION_WEIGHTS[i] = 1.0;

// Cejas: 17-26
for (let i = 17; i <= 26; i++) REGION_WEIGHTS[i] = 0.8;

// Nariz: 27-35
for (let i = 27; i <= 35; i++) REGION_WEIGHTS[i] = 1.5;

// Ojos: 36-47
for (let i = 36; i <= 47; i++) REGION_WEIGHTS[i] = 1.0;

// Boca: 48-67
for (let i = 48; i <= 67; i++) REGION_WEIGHTS[i] = 0.5;

export function compareNormalizedLandmarks(stored: Point2D[], captured: Point2D[]): number {
  if (stored.length < 68 || captured.length < 68) return 1;

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < 68; i++) {
    const w = REGION_WEIGHTS[i] || 1.0;
    const dx = stored[i].x - captured[i].x;
    const dy = stored[i].y - captured[i].y;
    weightedSum += w * (dx * dx + dy * dy);
    totalWeight += w;
  }

  if (totalWeight === 0) return 1;

  return Math.sqrt(weightedSum / totalWeight);
}
