/**
 * Comprehensive Facial Attribute Analysis — 70+ attributes from 68 landmarks.
 * Inspired by Perfect Corp AI Facial Analyzer.
 *
 * Landmarks 68 layout (dlib / face-api.js):
 *   0-16:  Jaw line       17-21: Right eyebrow    22-26: Left eyebrow
 *  27-30:  Nose bridge    31-35: Nose bottom       36-41: Right eye
 *  42-47:  Left eye       48-59: Outer lips        60-67: Inner lips
 */

export interface Point2D { x: number; y: number; }

// ─── Helpers ──────────────────────────────────────────────

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function mid(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function angleBetween(a: Point2D, v: Point2D, b: Point2D): number {
  const v1 = { x: a.x - v.x, y: a.y - v.y };
  const v2 = { x: b.x - v.x, y: b.y - v.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot / (m1 * m2)))) * (180 / Math.PI);
}

function slope(a: Point2D, b: Point2D): number {
  if (b.x === a.x) return Infinity;
  return (b.y - a.y) / (b.x - a.x);
}

function angleDeg(a: Point2D, b: Point2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Types ──────────────────────────────────────────────

export interface FaceShapeResult {
  principal: string;
  scores: Record<string, number>;
  percentages: Record<string, number>;
}

export interface EyeAttributes {
  tamanoIzquierdo: number;
  tamanoDerecho: number;
  tamano: string;
  separacion: string;
  distanciaInterpupilar: number;
  relacionAspectoIzq: number;
  relacionAspectoDer: number;
  anguloInclinacion: number;
  inclinacion: string;
  tamanoRelativo: string;
  forma: string;
}

export interface EyebrowAttributes {
  grosorIzq: number;
  grosorDer: number;
  grosor: string;
  arcoIzq: number;
  arcoDer: number;
  arco: string;
  longitudIzq: number;
  longitudDer: number;
  longitud: string;
  distanciaEntreCejas: number;
  separacion: string;
  inclinacion: number;
  inclinacionStr: string;
}

export interface NoseAttributes {
  largo: number;
  ancho: number;
  relacionLargoAncho: string;
  anguloPuente: number;
  anguloPunta: number;
  proyeccionPunta: string;
  anchoRelativo: string;
  forma: string;
}

export interface LipAttributes {
  plenitud: string;
  ancho: number;
  anchoRelativo: string;
  relacionSupInf: number;
  formaArcoCupido: string;
  espesorSup: number;
  espesorInf: number;
  espesor: string;
  distanciaNarizLabios: number;
}

export interface JawAttributes {
  anguloMandibula: number;
  tipoAngulo: string;
  anchoMandibula: number;
  definicion: string;
  proyeccionMenton: number;
  tipoMenton: string;
  anchuraRelativa: string;
}

export interface SymmetryResult {
  global: number;
  ojos: number;
  nariz: number;
  boca: number;
  mandibula: number;
  cejas: number;
}

export interface GoldenRatioResult {
  ratioGeneral: number;
  puntuacion: number;
  ratios: Record<string, number>;
}

export interface ProportionsResult {
  terciosVerticales: { frente: number; nariz: number; menton: number };
  quintosHorizontales: number[];
  ovalidadIndice: number;
  anchuraAltura: number;
}

export interface ColorAttributes {
  tonoPiel: { clasificacion: string; rgb: [number, number, number]; Fitzpatrick: string };
  colorCabello: { estimado: string; rgb: [number, number, number] };
  colorLabios: { estimado: string; rgb: [number, number, number] };
}

export interface FacialAnalysis {
  formaRostro: FaceShapeResult;
  proporciones: ProportionsResult;
  ojos: EyeAttributes;
  cejas: EyebrowAttributes;
  nariz: NoseAttributes;
  labios: LipAttributes;
  mandibula: JawAttributes;
  simetria: SymmetryResult;
  proporcionesAureas: GoldenRatioResult;
  colores: ColorAttributes | null;
  armoniaGeneral: number;
  puntuacionFinal: number;
  totalAtributos: number;
}

// ─── Main Analysis ──────────────────────────────────────

export function analyzeFace(landmarks: Point2D[], videoFrame?: ImageData | null): FacialAnalysis {
  const pts = landmarks;

  // Key reference points
  const eyeL = pts[36], eyeR = pts[45];
  const noseBridge = pts[27], noseTip = pts[30], noseBase = pts[33];
  const chin = pts[8];
  const mouthL = pts[48], mouthR = pts[54];
  const browL17 = pts[17], browL21 = pts[21];
  const browR22 = pts[22], browR26 = pts[26];
  const jawL = pts[0], jawR = pts[16];
  const jawMidL = pts[3], jawMidR = pts[13];
  const eyeCenter = mid(eyeL, eyeR);
  const browMid = mid(browL21, browR22);
  const mouthCenter = mid(mouthL, mouthR);

  // Scale references
  const interOcular = dist(eyeL, eyeR) || 1;
  const faceLength = dist(browMid, chin) || 1;
  const faceWidth = dist(jawL, jawR) || 1;

  // ─── 1. FACE SHAPE ────────────────────────────
  const jawWidth = dist(pts[2], pts[14]);
  const cheekboneWidth = dist(pts[1], pts[15]);
  const foreheadWidth = dist(browL17, browR26);
  const jawAngle = angleBetween(pts[5], chin, pts[11]);

  const jawToLen = jawWidth / faceLength;
  const cheekToLen = cheekboneWidth / faceLength;
  const foreheadToLen = foreheadWidth / faceLength;
  const foreheadToCheek = foreheadWidth / (cheekboneWidth || 1);
  const cheekToJaw = cheekboneWidth / (jawWidth || 1);
  const foreheadToJaw = foreheadWidth / (jawWidth || 1);

  const shapeScores: Record<string, number> = {
    ovalado: 0, redondo: 0, cuadrado: 0, alargado: 0,
    corazon: 0, diamante: 0, triangular: 0,
  };

  // alargado
  if (jawToLen < 0.60 && cheekToLen < 0.70 && foreheadToLen < 0.70) shapeScores.alargado += 3;
  if (jawToLen < 0.55) shapeScores.alargado += 1;

  // redondo
  if (jawToLen > 0.80 && jawToLen < 0.95 && cheekToLen > 0.80 && cheekToLen < 0.95) shapeScores.redondo += 3;
  if (jawAngle > 130 && jawToLen > 0.75) shapeScores.redondo += 1;

  // cuadrado
  if (jawToLen > 0.75 && jawToLen < 0.90 && cheekToLen > 0.80 && cheekToLen < 0.95) shapeScores.cuadrado += 2;
  if (jawAngle > 120 && jawAngle < 140 && foreheadToJaw > 0.85 && foreheadToJaw < 1.15) shapeScores.cuadrado += 2;

  // ovalado
  if (foreheadToJaw > 1.0 && foreheadToJaw < 1.2 && jawToLen > 0.60 && jawToLen < 0.80 && jawAngle > 115) shapeScores.ovalado += 3;
  if (foreheadToCheek > 0.90 && foreheadToCheek < 1.10 && cheekToJaw > 1.05) shapeScores.ovalado += 1;

  // corazon
  if (foreheadToCheek > 1.05 && cheekToJaw > 1.10) shapeScores.corazon += 2;
  if (foreheadToLen > 0.70 && jawToLen < 0.65) shapeScores.corazon += 2;
  if (jawAngle < 115 && jawToLen < 0.70) shapeScores.corazon += 1;

  // diamante
  if (cheekToLen > foreheadToLen && cheekToJaw > 1.05) shapeScores.diamante += 2;
  if (foreheadToCheek < 0.95 && cheekToJaw > 1.10) shapeScores.diamante += 2;

  // triangular
  if (foreheadToJaw < 0.95) shapeScores.triangular += 2;
  if (jawToLen > 0.80 && foreheadToLen < 0.70) shapeScores.triangular += 2;

  const shapeMax = Math.max(...Object.values(shapeScores));
  const shapePrincipal = Object.entries(shapeScores).find(([, v]) => v === shapeMax)![0];
  const shapeTotal = Object.values(shapeScores).reduce((s, v) => s + v, 0) || 1;
  const shapePercentages: Record<string, number> = {};
  for (const [k, v] of Object.entries(shapeScores)) {
    shapePercentages[k] = Math.round((v / shapeTotal) * 100);
  }

  // ─── 2. PROPORTIONS ───────────────────────────

  // Vertical thirds
  const hairlineY = pts[19].y - interOcular * 0.35;
  const browLineY = (pts[19].y + pts[24].y) / 2;
  const noseBaseY = pts[33].y;
  const chinY = chin.y;
  const vTotal = Math.max(1, chinY - hairlineY);
  const frente = Math.round(((browLineY - hairlineY) / vTotal) * 100);
  const nariz = Math.round(((noseBaseY - browLineY) / vTotal) * 100);
  const menton = 100 - frente - nariz;

  // Horizontal fifths
  const hBars = [pts[0].x, pts[36].x, pts[31].x, pts[35].x, pts[45].x, pts[16].x];
  const hWidths: number[] = [];
  let hTotal = 0;
  for (let i = 0; i < hBars.length - 1; i++) {
    const w = hBars[i + 1] - hBars[i];
    hWidths.push(w);
    hTotal += w;
  }
  const quintos = hWidths.map(w => Math.round((w / (hTotal || 1)) * 100));

  // Ovality
  const ovalidad = faceWidth / (faceLength || 1);

  // ─── 3. EYES ──────────────────────────────────
  const eyeSizeL = (dist(pts[36], pts[37]) + dist(pts[37], pts[38]) + dist(pts[38], pts[39]) + dist(pts[39], pts[40]) + dist(pts[40], pts[41]) + dist(pts[41], pts[36])) / 6;
  const eyeSizeR = (dist(pts[42], pts[43]) + dist(pts[43], pts[44]) + dist(pts[44], pts[45]) + dist(pts[45], pts[46]) + dist(pts[46], pts[47]) + dist(pts[47], pts[42])) / 6;

  // EAR (Eye Aspect Ratio) — vertical opening / horizontal width
  const vL1 = dist(pts[37], pts[41]);
  const vL2 = dist(pts[38], pts[40]);
  const hL = dist(pts[36], pts[39]);
  const earL = hL > 0 ? (vL1 + vL2) / (2 * hL) : 0;

  const vR1 = dist(pts[43], pts[47]);
  const vR2 = dist(pts[44], pts[46]);
  const hR = dist(pts[42], pts[45]);
  const earR = hR > 0 ? (vR1 + vR2) / (2 * hR) : 0;

  const eyeAngleVal = angleDeg(eyeL, eyeR);
  const interEyeDist = dist(eyeL, eyeR);
  const eyeSepRatio = interEyeDist / (faceWidth || 1);

  const tamanoEye = (eyeSizeL + eyeSizeR) / 2;
  let tamanoStr = 'Mediano';
  if (tamanoEye > interOcular * 0.30) tamanoStr = 'Grande';
  else if (tamanoEye < interOcular * 0.22) tamanoStr = 'Pequenio';

  let sepStr = 'Normal';
  if (eyeSepRatio > 0.35) sepStr = 'Separados';
  else if (eyeSepRatio < 0.25) sepStr = 'Cercanos';

  let inclStr = 'Horizontal';
  if (eyeAngleVal > 5) inclStr = 'Inclinado hacia arriba';
  else if (eyeAngleVal < -5) inclStr = 'Inclinado hacia abajo';

  let tamRel = 'Proporcional';
  const eyeRelFace = (eyeSizeL + eyeSizeR) / 2 / (faceWidth || 1);
  if (eyeRelFace > 0.12) tamRel = 'Grandes para el rostro';
  else if (eyeRelFace < 0.08) tamRel = 'Pequenios para el rostro';

  let formaEye = 'Almendrado';
  if (earL > 0.45 || earR > 0.45) formaEye = 'Redondo';
  else if (earL < 0.25 && earR < 0.25) formaEye = 'Estrecho';

  // ─── 4. EYEBROWS ──────────────────────────────
  const browThicknessL = (dist(pts[17], pts[0]) + dist(pts[18], pts[1])) / 2;
  const browThicknessR = (dist(pts[26], pts[16]) + dist(pts[25], pts[15])) / 2;
  const browArchL = dist(pts[18], mid(pts[17], pts[21]));
  const browArchR = dist(pts[24], mid(pts[22], pts[26]));
  const browLenL = dist(pts[17], pts[21]);
  const browLenR = dist(pts[22], pts[26]);
  const browDist = dist(browL21, browR22);
  const browInclination = angleDeg(pts[17], pts[21]);

  const grosorProm = (browThicknessL + browThicknessR) / 2;
  let grosorStr = 'Medio';
  if (grosorProm > interOcular * 0.12) grosorStr = 'Grueso';
  else if (grosorProm < interOcular * 0.06) grosorStr = 'Fino';

  const arcoProm = (browArchL + browArchR) / 2;
  let arcoStr = 'Medio';
  if (arcoProm > interOcular * 0.12) arcoStr = 'Pronunciado';
  else if (arcoProm < interOcular * 0.06) arcoStr = 'Plano';

  const longitudProm = (browLenL + browLenR) / 2;
  let longStr = 'Media';
  if (longStr && longitudProm > interOcular * 0.55) longStr = 'Larga';
  else if (longitudProm < interOcular * 0.38) longStr = 'Corta';

  let sepCejas = 'Normal';
  if (browDist < interOcular * 0.5) sepCejas = 'Cercanas';
  else if (browDist > interOcular * 0.8) sepCejas = 'Separadas';

  let inclBrowStr = 'Horizontal';
  if (browInclination > 8) inclBrowStr = 'Elevada externamente';
  else if (browInclination < -8) inclBrowStr = 'Elevada internamente';

  // ─── 5. NOSE ──────────────────────────────────
  const noseLength = dist(noseBridge, noseTip);
  const noseWidth = dist(pts[31], pts[35]);
  const nostrilWidth = dist(pts[33], pts[35]);
  const noseBridgeAngle = angleDeg(noseBridge, noseTip);
  const noseTipAngle = angleBetween(pts[34], noseTip, pts[32]);
  const noseProj = dist(noseTip, noseBase);

  const relacionLargoAncho = noseLength / (noseWidth || 1);
  let relNoseStr = 'Promedio';
  if (relacionLargoAncho > 2.0) relNoseStr = 'Largo y estrecho';
  else if (relacionLargoAncho < 1.2) relNoseStr = 'Corto y ancho';

  let anchoRel = 'Proporcional';
  const noseWidthRel = noseWidth / (faceWidth || 1);
  if (noseWidthRel > 0.28) anchoRel = 'Ancho para el rostro';
  else if (noseWidthRel < 0.18) anchoRel = 'Estrecho para el rostro';

  let formaNose = 'Recto';
  if (noseBridgeAngle > 10) formaNose = 'Curvado hacia abajo';
  else if (noseBridgeAngle < -10) formaNose = 'Curvado hacia arriba';

  let proyeccionStr = 'Media';
  const projRatio = noseProj / (noseLength || 1);
  if (projRatio > 0.55) proyeccionStr = 'Proyectada';
  else if (projRatio < 0.3) proyeccionStr = 'Plana';

  // ─── 6. LIPS ──────────────────────────────────
  const mouthWidth = dist(mouthL, mouthR);
  const upperLipThickness = dist(pts[62], pts[51]);
  const lowerLipThickness = dist(pts[62], pts[57]);
  const lipRatio = upperLipThickness / (lowerLipThickness || 1);
  const cupidBowDepth = dist(pts[51], mid(pts[50], pts[52]));
  const noseToMouth = dist(noseBase, mouthCenter);

  let plenitudStr = 'Media';
  const lipFullness = (upperLipThickness + lowerLipThickness) / (interOcular || 1);
  if (lipFullness > 0.35) plenitudStr = 'Labios llenos';
  else if (lipFullness < 0.2) plenitudStr = 'Labios delgados';

  let anchoRelLab = 'Proporcional';
  const mouthWidthRel = mouthWidth / (faceWidth || 1);
  if (mouthWidthRel > 0.55) anchoRelLab = 'Anchos para el rostro';
  else if (mouthWidthRel < 0.35) anchoRelLab = 'Estrechos para el rostro';

  let formaCupido = 'Pronunciado';
  if (cupidBowDepth < interOcular * 0.02) formaCupido = 'Suave';
  else if (cupidBowDepth > interOcular * 0.06) formaCupido = 'Muy marcado';

  let espesorStr = 'Medio';
  if (upperLipThickness + lowerLipThickness > interOcular * 0.35) espesorStr = 'Grueso';
  else if (upperLipThickness + lowerLipThickness < interOcular * 0.18) espesorStr = 'Delgado';

  // ─── 7. JAW / CHIN ────────────────────────────
  const jawWidthCalc = dist(jawL, jawR);
  const chinProjection = dist(chin, mid(mouthL, mouthR));
  const chinAngle = angleBetween(pts[6], chin, pts[10]);

  let tipoAnguloStr = 'Redondeado';
  if (jawAngle > 130) tipoAnguloStr = 'Muy redondeado';
  else if (jawAngle < 110) tipoAnguloStr = 'Angulado';

  let definicionStr = 'Media';
  if (jawAngle < 115) definicionStr = 'Bien definida';
  else if (jawAngle > 140) definicionStr = 'Suave';

  let tipoMentonStr = 'Proporcionado';
  const chinRatio = chinProjection / (interOcular || 1);
  if (chinRatio > 0.5) tipoMentonStr = 'Prominente';
  else if (chinRatio < 0.25) tipoMentonStr = 'Retrogrado';

  let anchuraRelJaw = 'Proporcional';
  const jawRelFace = jawWidthCalc / (faceWidth || 1);
  if (jawRelFace > 0.95) anchuraRelJaw = 'Ancha para el rostro';
  else if (jawRelFace < 0.75) anchuraRelJaw = 'Estrecha para el rostro';

  // ─── 8. SYMMETRY ──────────────────────────────
  // Mirror landmarks around vertical axis (nose bridge → chin)
  const axis = { x: noseBridge.x, dirX: 0, dirY: 1 }; // vertical axis at nose x

  function mirrorX(p: Point2D): Point2D {
    return { x: 2 * axis.x - p.x, y: p.y };
  }

  // Jaw symmetry
  const jawSymPairs = [[0, 16], [1, 15], [2, 14], [3, 13], [4, 12], [5, 11], [6, 10], [7, 9]];
  let jawSymSum = 0;
  for (const [l, r] of jawSymPairs) {
    const d = dist(pts[l], mirrorX(pts[r]));
    jawSymSum += d / (interOcular || 1);
  }
  const jawSymScore = Math.max(0, 100 - (jawSymSum / jawSymPairs.length) * 200);

  // Eye symmetry
  const eyeSymPairs = [[36, 45], [37, 44], [38, 43], [39, 42], [40, 47], [41, 46]];
  let eyeSymSum = 0;
  for (const [l, r] of eyeSymPairs) {
    const d = dist(pts[l], mirrorX(pts[r]));
    eyeSymSum += d / (interOcular || 1);
  }
  const eyeSymScore = Math.max(0, 100 - (eyeSymSum / eyeSymPairs.length) * 250);

  // Nose symmetry
  const noseSymPairs = [[31, 35], [32, 34]];
  let noseSymSum = 0;
  for (const [l, r] of noseSymPairs) {
    const d = dist(pts[l], mirrorX(pts[r]));
    noseSymSum += d / (interOcular || 1);
  }
  const noseSymScore = Math.max(0, 100 - (noseSymSum / noseSymPairs.length) * 300);

  // Mouth symmetry
  const mouthSymPairs = [[48, 54], [49, 53], [50, 52], [60, 64], [61, 63]];
  let mouthSymSum = 0;
  for (const [l, r] of mouthSymPairs) {
    const d = dist(pts[l], mirrorX(pts[r]));
    mouthSymSum += d / (interOcular || 1);
  }
  const mouthSymScore = Math.max(0, 100 - (mouthSymSum / mouthSymPairs.length) * 200);

  // Brow symmetry
  const browSymPairs = [[17, 26], [18, 25], [19, 24], [20, 23], [21, 22]];
  let browSymSum = 0;
  for (const [l, r] of browSymPairs) {
    const d = dist(pts[l], mirrorX(pts[r]));
    browSymSum += d / (interOcular || 1);
  }
  const browSymScore = Math.max(0, 100 - (browSymSum / browSymPairs.length) * 200);

  const globalSym = Math.round((jawSymScore * 0.2 + eyeSymScore * 0.25 + noseSymScore * 0.2 + mouthSymScore * 0.2 + browSymScore * 0.15));

  // ─── 9. GOLDEN RATIO ──────────────────────────
  const PHI = 1.61803398875;
  const grRatios: Record<string, number> = {};

  grRatios['faceHeight_faceWidth'] = faceLength / (faceWidth || 1);
  grRatios['mouthWidth_noseWidth'] = mouthWidth / (noseWidth || 1);
  grRatios['faceWidth_mouthWidth'] = faceWidth / (mouthWidth || 1);
  grRatios['noseWidth_mouthWidth'] = noseWidth / (mouthWidth || 1);
  grRatios['eyeSpacing_interOcular'] = interEyeDist / (interOcular || 1);
  grRatios['faceLength_interOcular'] = faceLength / interOcular;
  grRatios['jawWidth_interOcular'] = jawWidthCalc / interOcular;
  grRatios['cheekboneWidth_faceWidth'] = cheekboneWidth / (faceWidth || 1);
  grRatios['noseLength_faceLength'] = noseLength / faceLength;
  grRatios['upperThird_lowerThird'] = ((browLineY - hairlineY) / vTotal) / ((chinY - noseBaseY) / vTotal || 1);
  grRatios['foreheadJaw_ratio'] = foreheadToJaw;
  grRatios['eyeMouth_faceHeight'] = dist(eyeCenter, mouthCenter) / faceLength;
  grRatios['mouthChin_lowerThird'] = dist(mouthCenter, chin) / (chinY - noseBaseY || 1);
  grRatios['noseMouth_noseLength'] = noseToMouth / (noseLength || 1);

  // Score: how close each ratio is to PHI
  let grScoreSum = 0;
  for (const v of Object.values(grRatios)) {
    const diff = Math.abs(v - PHI);
    const score = Math.max(0, 100 - diff * 40);
    grScoreSum += score;
  }
  const grScore = Math.round(grScoreSum / Object.keys(grRatios).length);

  const avgRatio = Object.values(grRatios).reduce((s, v) => s + v, 0) / Object.values(grRatios).length;

  // ─── 10. COLOR (from video frame if available) ──
  let colors: ColorAttributes | null = null;
  if (videoFrame) {
    colors = analyzeColors(pts, videoFrame, interOcular);
  }

  // ─── 11. HARMONY & FINAL SCORE ────────────────
  const armonia = Math.round(
    globalSym * 0.25 +
    grScore * 0.25 +
    (shapePercentages[shapePrincipal] || 0) * 0.2 +
    Math.min(100, Math.abs(frente - 33) < 5 ? 100 : 80) * 0.15 +
    Math.min(100, Math.abs(nariz - 33) < 5 ? 100 : 80) * 0.15
  );

  const puntuacion = Math.round(armonia * 0.6 + grScore * 0.25 + globalSym * 0.15);

  return {
    formaRostro: {
      principal: shapePrincipal,
      scores: shapeScores,
      percentages: shapePercentages,
    },
    proporciones: {
      terciosVerticales: { frente, nariz, menton },
      quintosHorizontales: quintos,
      ovalidadIndice: Math.round(ovalidad * 100) / 100,
      anchuraAltura: Math.round((faceWidth / faceLength) * 100) / 100,
    },
    ojos: {
      tamanoIzquierdo: Math.round(eyeSizeL * 10) / 10,
      tamanoDerecho: Math.round(eyeSizeR * 10) / 10,
      tamano: tamanoStr,
      separacion: sepStr,
      distanciaInterpupilar: Math.round(interEyeDist),
      relacionAspectoIzq: Math.round(earL * 100) / 100,
      relacionAspectoDer: Math.round(earR * 100) / 100,
      anguloInclinacion: Math.round(eyeAngleVal * 10) / 10,
      inclinacion: inclStr,
      tamanoRelativo: tamRel,
      forma: formaEye,
    },
    cejas: {
      grosorIzq: Math.round(browThicknessL * 10) / 10,
      grosorDer: Math.round(browThicknessR * 10) / 10,
      grosor: grosorStr,
      arcoIzq: Math.round(browArchL * 10) / 10,
      arcoDer: Math.round(browArchR * 10) / 10,
      arco: arcoStr,
      longitudIzq: Math.round(browLenL * 10) / 10,
      longitudDer: Math.round(browLenR * 10) / 10,
      longitud: longStr,
      distanciaEntreCejas: Math.round(browDist),
      separacion: sepCejas,
      inclinacion: Math.round(browInclination * 10) / 10,
      inclinacionStr: inclBrowStr,
    },
    nariz: {
      largo: Math.round(noseLength),
      ancho: Math.round(noseWidth),
      relacionLargoAncho: relNoseStr,
      anguloPuente: Math.round(noseBridgeAngle * 10) / 10,
      anguloPunta: Math.round(noseTipAngle),
      proyeccionPunta: proyeccionStr,
      anchoRelativo: anchoRel,
      forma: formaNose,
    },
    labios: {
      plenitud: plenitudStr,
      ancho: Math.round(mouthWidth),
      anchoRelativo: anchoRelLab,
      relacionSupInf: Math.round(lipRatio * 100) / 100,
      formaArcoCupido: formaCupido,
      espesorSup: Math.round(upperLipThickness),
      espesorInf: Math.round(lowerLipThickness),
      espesor: espesorStr,
      distanciaNarizLabios: Math.round(noseToMouth),
    },
    mandibula: {
      anguloMandibula: Math.round(jawAngle),
      tipoAngulo: tipoAnguloStr,
      anchoMandibula: Math.round(jawWidthCalc),
      definicion: definicionStr,
      proyeccionMenton: Math.round(chinProjection),
      tipoMenton: tipoMentonStr,
      anchuraRelativa: anchuraRelJaw,
    },
    simetria: {
      global: clamp(Math.round(globalSym), 0, 100),
      ojos: clamp(Math.round(eyeSymScore), 0, 100),
      nariz: clamp(Math.round(noseSymScore), 0, 100),
      boca: clamp(Math.round(mouthSymScore), 0, 100),
      mandibula: clamp(Math.round(jawSymScore), 0, 100),
      cejas: clamp(Math.round(browSymScore), 0, 100),
    },
    proporcionesAureas: {
      ratioGeneral: Math.round(avgRatio * 1000) / 1000,
      puntuacion: clamp(grScore, 0, 100),
      ratios: grRatios,
    },
    colores: colors,
    armoniaGeneral: clamp(armonia, 0, 100),
    puntuacionFinal: clamp(puntuacion, 0, 100),
    totalAtributos: 75,
  };
}

// ─── Color Analysis from ImageData ───────────────────

function analyzeColors(pts: Point2D[], imgData: ImageData, _scale: number): ColorAttributes {
  const { data, width, height } = imgData;

  function sampleRegion(cx: number, cy: number, radius: number): [number, number, number] {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(width - 1, Math.floor(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(height - 1, Math.floor(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * width + x) * 4;
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count++;
      }
    }
    if (count === 0) return [128, 128, 128];
    return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
  }

  // Skin: forehead + cheeks
  const foreheadPt = { x: (pts[19].x + pts[24].x) / 2, y: pts[19].y - Math.abs(pts[19].y - pts[24].y) * 0.5 };
  const cheekL = { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
  const cheekR = { x: (pts[14].x + pts[15].x) / 2, y: (pts[14].y + pts[15].y) / 2 };

  const skinSamples = [
    sampleRegion(foreheadPt.x, foreheadPt.y, 8),
    sampleRegion(cheekL.x, cheekL.y, 6),
    sampleRegion(cheekR.x, cheekR.y, 6),
  ];
  const skinRgb: [number, number, number] = [
    Math.round(skinSamples.reduce((s, c) => s + c[0], 0) / 3),
    Math.round(skinSamples.reduce((s, c) => s + c[1], 0) / 3),
    Math.round(skinSamples.reduce((s, c) => s + c[2], 0) / 3),
  ];

  const luminance = (skinRgb[0] * 0.299 + skinRgb[1] * 0.587 + skinRgb[2] * 0.114) / 255;
  let fitzpatrick = 'Tipo III (Claro)';
  let clasificacionPiel = 'Claro';
  if (luminance > 0.75) { fitzpatrick = 'Tipo I-II (Muy claro)'; clasificacionPiel = 'Muy claro'; }
  else if (luminance > 0.55) { fitzpatrick = 'Tipo III-IV (Medio)'; clasificacionPiel = 'Medio'; }
  else if (luminance > 0.35) { fitzpatrick = 'Tipo IV-V (Moreno)'; clasificacionPiel = 'Moreno'; }
  else { fitzpatrick = 'Tipo V-VI (Oscuro)'; clasificacionPiel = 'Oscuro'; }

  // Lips
  const lipCenter = mid(pts[62], pts[51]);
  const lipRgb = sampleRegion(lipCenter.x, lipCenter.y, 4);
  let lipColor = 'Natural';
  if (lipRgb[0] > 180 && lipRgb[2] < 140) lipColor = 'Rosado/Color';
  else if (lipRgb[0] > 150) lipColor = 'Rosado oscuro';

  // Hair (top of head)
  const hairPt = { x: foreheadPt.x, y: Math.max(0, pts[19].y - Math.abs(pts[19].y - pts[24].y) * 1.5) };
  const hairRgb = sampleRegion(hairPt.x, hairPt.y, 10);
  const hairLum = (hairRgb[0] * 0.299 + hairRgb[1] * 0.587 + hairRgb[2] * 0.114) / 255;
  let hairColor = 'Castaño oscuro';
  if (hairLum > 0.6) hairColor = 'Rubio';
  else if (hairLum > 0.4) hairColor = 'Castaño';
  else if (hairLum > 0.2) hairColor = 'Castaño oscuro';
  else hairColor = 'Negro';

  return {
    tonoPiel: { clasificacion: clasificacionPiel, rgb: skinRgb, Fitzpatrick: fitzpatrick },
    colorCabello: { estimado: hairColor, rgb: hairRgb },
    colorLabios: { estimado: lipColor, rgb: lipRgb },
  };
}

// ─── Label Map (Spanish) ─────────────────────────────

export const SHAPE_LABELS: Record<string, string> = {
  ovalado: 'Ovalado',
  redondo: 'Redondo',
  cuadrado: 'Cuadrado',
  alargado: 'Alargado',
  corazon: 'Corazon',
  diamante: 'Diamante',
  triangular: 'Triangular',
};

export const SHAPE_ICONS: Record<string, string> = {
  ovalado: '🥚',
  redondo: '🟡',
  cuadrado: '🔲',
  alargado: '📏',
  corazon: '❤️',
  diamante: '💎',
  triangular: '🔺',
};
