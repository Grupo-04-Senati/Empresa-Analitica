/**
 * faceGeometry.ts - Sistema de reconocimiento basado en PROPORCIONES
 *
 * CONCEPTO CLAVE:
 *   ratio = distancia(A,B) / distancia(C,D)
 *
 *   Si te alejas 2x de la cámara, TODAS las distancias se duplican,
 *   pero los RATIOS se mantienen IGUALES.
 *
 *   Ejemplo: ojos_nariz / ojos_boca = 0.47 estando cerca
 *            ojos_nariz / ojos_boca = 0.47 estando lejos
 *            -> MISMO RATIO = MISMA PERSONA
 *
 *   Tu amigo gordito tiene proporciones faciales DIFERENTES,
 *   así que sus ratios serán DISTINTOS aunque esté en la misma posición.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface FaceRatios {
  // Ratios de estructura (más estables)
  eyeWidth_to_faceWidth: number;
  noseLength_to_faceHeight: number;
  mouthWidth_to_faceWidth: number;
  faceWidth_to_faceHeight: number;
  upperFace_to_lowerFace: number;
  eyeToMouth_to_faceHeight: number;
  noseToMouth_to_noseLength: number;
  // Ratios de distancia entre regiones (clave para distinguir personas)
  noseBridge_to_noseTip: number;
  leftEye_to_noseTip: number;
  rightEye_to_noseTip: number;
  leftMouthCorner_to_noseTip: number;
  rightMouthCorner_to_noseTip: number;
  chin_to_noseTip: number;
  leftJaw_to_chin: number;
  rightJaw_to_chin: number;
  forehead_to_chin: number;
  leftBrow_to_rightBrow: number;
  noseWidth_to_noseLength: number;
  interEye_to_noseLength: number;
  eyeHeight_to_eyeWidth: number;
  lipHeight_to_mouthWidth: number;
}

// ── FUNCIONES MATEMÁTICAS ──────────────────────────────────

export function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── EXTRAER68 PUNTOS A COORDENADAS ─────────────────────────

export function extractCoordinates(landmarks: any[]): Point2D[] {
  return landmarks.map((p: any) => ({ x: Number(p.x), y: Number(p.y) }));
}

// ── CALCULAR RATIOS DEL ROSTRO ─────────────────────────────
// Estos ratios son INVARIANTES a la distancia de la cámara.

export function calculateRatios(pts: Point2D[]): FaceRatios | null {
  if (pts.length < 68) return null;

  // Puntos clave del rostro
  const leftEyeOuter = pts[36];    // esquina externa ojo izq
  const rightEyeOuter = pts[45];   // esquina externa ojo der
  const leftEyeInner = pts[39];    // esquina interna ojo izq
  const rightEyeInner = pts[42];   // esquina interna ojo der
  const noseBridge = pts[27];       // puente nariz
  const noseTip = pts[30];          // punta nariz
  const noseBottom = pts[33];       // base nariz
  const noseLeft = pts[31];         // ala izq nariz
  const noseRight = pts[35];        // ala der nariz
  const chin = pts[8];              // mentón
  const leftMouth = pts[48];        // comisura izq
  const rightMouth = pts[54];       // comisura der
  const upperLip = pts[51];         // labio superior
  const lowerLip = pts[57];         // labio inferior
  const leftJaw = pts[0];           // mandíbula izq
  const rightJaw = pts[16];         // mandíbula der
  const forehead = pts[27];         // frente (puente)
  const leftBrow = pts[19];         // ceja izq
  const rightBrow = pts[24];        // ceja der
  const leftEyeTop = pts[37];       // ojo izq arriba
  const leftEyeBottom = pts[41];    // ojo izq abajo
  const rightEyeTop = pts[43];      // ojo der arriba
  const rightEyeBottom = pts[47];   // ojo der abajo
  const mouthCenter = mid(leftMouth, rightMouth);

  // Distancias principales
  const faceWidth = dist(leftJaw, rightJaw);
  const faceHeight = dist(forehead, chin);
  const interEye = dist(leftEyeOuter, rightEyeOuter);
  const noseLength = dist(noseBridge, noseTip);
  const noseWidth = dist(noseLeft, noseRight);
  const mouthWidth = dist(leftMouth, rightMouth);
  const eyeWidth_left = dist(leftEyeOuter, leftEyeInner);
  const eyeWidth_right = dist(rightEyeInner, rightEyeOuter);
  const eyeHeight_left = dist(leftEyeTop, leftEyeBottom);
  const eyeHeight_right = dist(rightEyeTop, rightEyeBottom);
  const lipHeight = dist(upperLip, lowerLip);
  const browDist = dist(leftBrow, rightBrow);
  const eyeToMouth = dist(mid(leftEyeOuter, rightEyeOuter), mouthCenter);
  const noseToMouth = dist(noseTip, mouthCenter);
  const upperFace = dist(mid(leftEyeOuter, rightEyeOuter), forehead);
  const lowerFace = dist(mouthCenter, chin);

  // Distancias clave NARIZ↔OTRAS ZONAS (las más importantes para identificar)
  const noseToEyeLeft = dist(noseTip, leftEyeOuter);
  const noseToEyeRight = dist(noseTip, rightEyeOuter);
  const noseToMouthLeft = dist(noseTip, leftMouth);
  const noseToMouthRight = dist(noseTip, rightMouth);
  const noseToChin = dist(noseTip, chin);
  const noseToForehead = dist(noseTip, forehead);

  // Distancias MANDÍBULA↔OTRAS ZONAS
  const jawToChinLeft = dist(leftJaw, chin);
  const jawToChinRight = dist(rightJaw, chin);

  // Referencia para normalizar
  const ref = interEye || faceWidth || 1;

  return {
    // Estructura general
    eyeWidth_to_faceWidth: (eyeWidth_left + eyeWidth_right) / (2 * faceWidth),
    noseLength_to_faceHeight: noseLength / faceHeight,
    mouthWidth_to_faceWidth: mouthWidth / faceWidth,
    faceWidth_to_faceHeight: faceWidth / faceHeight,
    upperFace_to_lowerFace: upperFace / lowerFace,
    eyeToMouth_to_faceHeight: eyeToMouth / faceHeight,
    noseToMouth_to_noseLength: noseToMouth / noseLength,

    // Distancias nariz↔regiones (ESTAS SON LAS CLAVE)
    noseBridge_to_noseTip: noseLength / ref,
    leftEye_to_noseTip: noseToEyeLeft / ref,
    rightEye_to_noseTip: noseToEyeRight / ref,
    leftMouthCorner_to_noseTip: noseToMouthLeft / ref,
    rightMouthCorner_to_noseTip: noseToMouthRight / ref,
    chin_to_noseTip: noseToChin / ref,
    leftJaw_to_chin: jawToChinLeft / ref,
    rightJaw_to_chin: jawToChinRight / ref,
    forehead_to_chin: noseToForehead / ref,
    leftBrow_to_rightBrow: browDist / ref,
    noseWidth_to_noseLength: noseWidth / noseLength,
    interEye_to_noseLength: interEye / noseLength,
    eyeHeight_to_eyeWidth: (eyeHeight_left + eyeHeight_right) / (2 * ((eyeWidth_left + eyeWidth_right) / 2)),
    lipHeight_to_mouthWidth: lipHeight / mouthWidth,
  };
}

// ── CALCULAR RATIOS RAW (array numérico para comparación) ──

export function ratiosToNumbers(r: FaceRatios): number[] {
  return [
    r.eyeWidth_to_faceWidth,
    r.noseLength_to_faceHeight,
    r.mouthWidth_to_faceWidth,
    r.faceWidth_to_faceHeight,
    r.upperFace_to_lowerFace,
    r.eyeToMouth_to_faceHeight,
    r.noseToMouth_to_noseLength,
    r.noseBridge_to_noseTip,
    r.leftEye_to_noseTip,
    r.rightEye_to_noseTip,
    r.leftMouthCorner_to_noseTip,
    r.rightMouthCorner_to_noseTip,
    r.chin_to_noseTip,
    r.leftJaw_to_chin,
    r.rightJaw_to_chin,
    r.forehead_to_chin,
    r.leftBrow_to_rightBrow,
    r.noseWidth_to_noseLength,
    r.interEye_to_noseLength,
    r.eyeHeight_to_eyeWidth,
    r.lipHeight_to_mouthWidth,
  ];
}

// ── GENERAR FIRMA DE RATIOS ────────────────────────────────

export function generateRatioSignature(pts: Point2D[]): number[] {
  const ratios = calculateRatios(pts);
  if (!ratios) return [];
  return ratiosToNumbers(ratios);
}

// ── COMPARAR DOS FIRMAS DE RATIOS ──────────────────────────
// Retorna similitud [0, 1]. 1 = idéntico. 0 = totalmente diferente.
// CLAVE: Esta comparación es INVARIANTE a la distancia de la cámara.

export function compareRatioSignatures(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let sumAbsDiff = 0;
  let maxAbsDiff = 0;

  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs(a[i] - b[i]);
    sumAbsDiff += diff;
    if (diff > maxAbsDiff) maxAbsDiff = diff;
  }

  const meanAbsDiff = sumAbsDiff / a.length;

  // Si la diferencia promedio es mayor a 0.3, son personas muy diferentes
  // Si es menor a 0.05, son casi idénticas
  const similarity = Math.max(0, Math.min(1, 1 - meanAbsDiff * 3));

  return Math.round(similarity * 1000) / 1000;
}

// ── COMPARAR RATIOS CON PESOS ──────────────────────────────
// Algunos ratios son más discriminadores que otros.

export function compareRatioSignaturesWeighted(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  // Pesos: los ratios nariz↔regiones son los más importantes
  const weights = [
    1.0,  // eyeWidth_to_faceWidth
    1.2,  // noseLength_to_faceHeight
    1.0,  // mouthWidth_to_faceWidth
    1.0,  // faceWidth_to_faceHeight
    0.8,  // upperFace_to_lowerFace
    1.0,  // eyeToMouth_to_faceHeight
    1.0,  // noseToMouth_to_noseLength
    2.0,  // noseBridge_to_noseTip ★
    2.5,  // leftEye_to_noseTip ★★
    2.5,  // rightEye_to_noseTip ★★
    2.0,  // leftMouthCorner_to_noseTip ★
    2.0,  // rightMouthCorner_to_noseTip ★
    2.0,  // chin_to_noseTip ★
    1.5,  // leftJaw_to_chin
    1.5,  // rightJaw_to_chin
    1.5,  // forehead_to_chin
    1.0,  // leftBrow_to_rightBrow
    1.8,  // noseWidth_to_noseLength ★
    1.5,  // interEye_to_noseLength
    1.2,  // eyeHeight_to_eyeWidth
    1.0,  // lipHeight_to_mouthWidth
  ];

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < a.length; i++) {
    const w = weights[i] || 1.0;
    const diff = Math.abs(a[i] - b[i]);
    weightedSum += w * diff;
    totalWeight += w;
  }

  const meanWeightedDiff = weightedSum / totalWeight;
  const similarity = Math.max(0, Math.min(1, 1 - meanWeightedDiff * 3));

  return Math.round(similarity * 1000) / 1000;
}

// ── NORMALIZACIÓN POR NARIZ (invariante a posición/escala) ─
//
// Cada punto se expresa como fracción de la distancia interocular,
// relativo a la punta de la nariz.
//
// Si te alejas 2x: todos los valores se mantienen iguales.

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

// ── COMPARACIÓN DE PUNTOS NORMALIZADOS (método auxiliar) ───

const REGION_WEIGHTS: Record<number, number> = {};
for (let i = 0; i <= 16; i++) REGION_WEIGHTS[i] = 1.0;
for (let i = 17; i <= 26; i++) REGION_WEIGHTS[i] = 0.8;
for (let i = 27; i <= 35; i++) REGION_WEIGHTS[i] = 1.5;
for (let i = 36; i <= 47; i++) REGION_WEIGHTS[i] = 1.0;
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

// ── COMPARACIÓN COMBINADA (ratios + puntos) ────────────────
//
// Método principal de comparación. Usa ratios como prioridad.

export function compareFaces(
  storedLandmarks: Point2D[],
  capturedLandmarks: Point2D[],
  storedRatios?: number[]
): { score: number; method: string } {
  // 1. Calcular ratios del rostro capturado
  const capturedRatios = generateRatioSignature(capturedLandmarks);

  // 2. Si tenemos ratios almacenados, comparar ratios (MÉTODO PRINCIPAL)
  if (storedRatios && storedRatios.length > 0 && capturedRatios.length > 0) {
    const ratioScore = compareRatioSignaturesWeighted(storedRatios, capturedRatios);

    // 3. También calcular ratios de los landmarks almacenados para comparar apples-to-apples
    const storedRatiosFromLm = generateRatioSignature(storedLandmarks);
    let ratioScore2 = ratioScore;
    if (storedRatiosFromLm.length > 0) {
      ratioScore2 = compareRatioSignaturesWeighted(storedRatiosFromLm, capturedRatios);
    }

    // Promediar ambos scores de ratios
    const finalRatioScore = (ratioScore + ratioScore2) / 2;

    // 4. Score auxiliar de puntos normalizados
    const normStored = normalizeLandmarksByNose(storedLandmarks);
    const normCaptured = normalizeLandmarksByNose(capturedLandmarks);
    const pointDist = compareNormalizedLandmarks(normStored, normCaptured);
    const pointScore = Math.max(0, 1 - pointDist * 2);

    // 5. Combinar: 80% ratios + 20% puntos
    const combined = finalRatioScore * 0.8 + pointScore * 0.2;

    return {
      score: Math.round(combined * 1000) / 1000,
      method: `ratios(${finalRatioScore.toFixed(3)}) + points(${pointScore.toFixed(3)})`,
    };
  }

  // Fallback: solo puntos normalizados
  const normStored = normalizeLandmarksByNose(storedLandmarks);
  const normCaptured = normalizeLandmarksByNose(capturedLandmarks);
  const pointDist = compareNormalizedLandmarks(normStored, normCaptured);
  const pointScore = Math.max(0, 1 - pointDist * 2);

  return {
    score: Math.round(pointScore * 1000) / 1000,
    method: `points_only(${pointScore.toFixed(3)})`,
  };
}

// ── COMPATIBILIDAD: exportar generateFaceSignature y FaceSignature ──

export interface FaceSignature {
  ratios: number[];
  angles: number[];
  vectors: number[];
  uniqueHash: string;
}

export function generateFaceSignature(pts: Point2D[]): FaceSignature {
  const ratios = generateRatioSignature(pts);
  const hash = ratios.map(v => v.toFixed(4)).join('|');
  return { ratios, angles: [], vectors: [], uniqueHash: hash };
}
