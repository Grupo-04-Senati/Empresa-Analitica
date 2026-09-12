import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Shield, Eye, Scan } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { loadFaceModels } from '../services/faceRecognition';
import { faceApiRegister, faceApiLogin } from '../services/faceApi';
import { generateFaceSignature, FaceSignature, Point2D } from '../services/faceGeometry';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  usuarioId?: number;
  onCapture?: (photos: Record<string, string>) => void;
  onLoginMatch?: (userId: number, nombre: string) => void;
  onClose: () => void;
}

const ANGLES = [
  { key: 'frontal', label: 'Frontal', instruction: 'Mira de frente a la camara' },
  { key: 'izquierda', label: 'Derecha', instruction: 'Gira la cabeza a la derecha' },
  { key: 'derecha', label: 'Izquierda', instruction: 'Gira la cabeza a la izquierda' },
];

type Phase = 'loading' | 'scanning' | 'countdown' | 'processing' | 'done' | 'error';

interface FaceGeometry {
  interEyeDist: number;
  noseLength: number;
  mouthWidth: number;
  jawWidth: number;
  faceWidth: number;
  faceHeight: number;
  eyeAngle: number;
  noseOffsetNorm: number;
  probability: number;
  distance: string;
}

interface FrozenDetection {
  landmarks: faceapi.FaceLandmarks68;
  score: number;
  videoW: number;
  videoH: number;
}

function interpolatePoints(pts: { x: number; y: number }[], count: number): { x: number; y: number }[] {
  if (pts.length < 2) return pts;
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const steps = Math.max(1, Math.floor(count / pts.length));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

function estimateDepth(pts: { x: number; y: number }[], center: { x: number; y: number }, eyeDist: number): number[] {
  return pts.map(p => {
    const dx = (p.x - center.x) / eyeDist;
    const dy = (p.y - center.y) / eyeDist;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - dist * 0.4);
  });
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ mode, usuarioId, onCapture, onLoginMatch, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentAngle, setCurrentAngle] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('Buscando rostro...');
  const [multiFace, setMultiFace] = useState(false);
  const [faceGeometry, setFaceGeometry] = useState<FaceGeometry | null>(null);
  const [faceSig, setFaceSig] = useState<FaceSignature | null>(null);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhase, setScanPhase] = useState('init');
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goodFramesRef = useRef(0);
  const scanFramesRef = useRef(0);
  const photosRef = useRef<Record<string, string>>({});
  const angleRef = useRef(0);
  const phaseRef = useRef<Phase>('loading');
  const startCaptureRef = useRef<() => void>(() => {});
  const doLoginRef = useRef<(photos: Record<string, string>) => void>(() => {});
  const frozenRef = useRef<FrozenDetection | null>(null);
  const scanStartTimeRef = useRef(0);

  photosRef.current = capturedPhotos;
  angleRef.current = currentAngle;
  phaseRef.current = phase;

  const stopAll = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); }
    if (intervalRef.current) { clearInterval(intervalRef.current); }
  }, []);

  const drawWireframeMask = useCallback((landmarks: faceapi.FaceLandmarks68, videoW: number, videoH: number, canvasW: number, canvasH: number) => {
    const overlay = overlayRef.current;
    if (!overlay || canvasW < 10 || canvasH < 10) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    const sx = canvasW / videoW, sy = canvasH / videoH;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasW, 0);

    const pts = landmarks.positions;
    const le36 = pts[36], le45 = pts[45];
    const eyeDist = Math.hypot(le45.x - le36.x, le45.y - le36.y);
    const nc = { x: (le36.x + le45.x) / 2, y: (le36.y + le45.y) / 2 };
    const fcx = canvasW / 2, fcy = canvasH / 2;

    const mapP = (p: { x: number; y: number }) => ({ x: (p.x - nc.x) * sx + fcx, y: (p.y - nc.y) * sy + fcy });

    const ip = (kp: { x: number; y: number }[], n: number): { x: number; y: number }[] => {
      if (kp.length < 2 || n < 2) return kp.map(mapP);
      const segs = kp.length - 1;
      const perSeg = Math.max(1, Math.round(n / segs));
      const r: { x: number; y: number }[] = [];
      for (let i = 0; i < segs; i++) {
        for (let s = 0; s < perSeg; s++) {
          const t = s / perSeg;
          r.push({ x: kp[i].x + (kp[i + 1].x - kp[i].x) * t, y: kp[i].y + (kp[i + 1].y - kp[i].y) * t });
        }
      }
      r.push(kp[kp.length - 1]);
      return r.map(mapP);
    };

    const circ = (cx: number, cy: number, r: number, n: number) => {
      const a: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2; a.push(mapP({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r })); }
      return a;
    };

    const jaw = pts.slice(0, 17), lbrow = pts.slice(17, 22), rbrow = pts.slice(22, 27);
    const nBr = pts.slice(27, 31), nBt = pts.slice(31, 36);
    const lE = pts.slice(36, 42), rE = pts.slice(42, 48);
    const mO = pts.slice(48, 60), mI = pts.slice(60, 68);
    const noseTip = pts[30], noseBase = pts[33];

    const faceW = Math.hypot(jaw[16].x - jaw[0].x, jaw[16].y - jaw[0].y);
    const faceH = Math.hypot(pts[8].x - nBr[0].x, pts[8].y - nBr[0].y);
    const faceAR = (faceW * faceH) / (videoW * videoH);
    const distLabel = faceAR < 0.02 ? 'MUY_LEJOS' : faceAR < 0.05 ? 'LEJOS' : faceAR > 0.18 ? 'MUY_CERCA' : faceAR > 0.12 ? 'CERCA' : 'OPTIMO';

    // === FACE OUTLINE (200 pts) ===
    const jawD = ip(jaw, 200);
    const chinD = ip([jaw[5], jaw[6], jaw[7], jaw[8], jaw[9], jaw[10], jaw[11]], 120);
    const lJawD = ip(jaw.slice(0, 8), 100);
    const rJawD = ip(jaw.slice(9, 17), 100);

    // === CHEEKBONE CONTOURS ===
    const lCheekD = ip([jaw[2], jaw[3], jaw[4], lE[0], lbrow[0]], 80);
    const rCheekD = ip([jaw[12], jaw[13], jaw[14], rE[4], rbrow[4]], 80);
    const lCheekBone = ip([jaw[1], jaw[3], { x: (lE[0].x + jaw[3].x) / 2, y: (lE[0].y + jaw[3].y) / 2 - eyeDist * 0.08 }, lE[0]], 60);
    const rCheekBone = ip([jaw[15], jaw[13], { x: (rE[4].x + jaw[13].x) / 2, y: (rE[4].y + jaw[13].y) / 2 - eyeDist * 0.08 }, rE[4]], 60);

    // === NASOLABIAL FOLDS (nose to mouth) ===
    const lNasoFold = ip([nBt[0], { x: nBt[0].x + eyeDist * 0.05, y: (nBt[0].y + mO[0].y) / 2 }, mO[0]], 50);
    const rNasoFold = ip([nBt[4], { x: nBt[4].x - eyeDist * 0.05, y: (nBt[4].y + mO[6].y) / 2 }, mO[6]], 50);

    // === FOREHEAD (100 pts + wrinkle lines) ===
    const foreheadD = ip([lbrow[0], lbrow[1], lbrow[2], { x: nc.x, y: lbrow[2].y - eyeDist * 0.55 }, rbrow[2], rbrow[3], rbrow[4]], 100);
    const foreheadTop = ip([{ x: lbrow[0].x - eyeDist * 0.05, y: lbrow[0].y - eyeDist * 0.6 }, { x: nc.x, y: lbrow[2].y - eyeDist * 0.7 }, { x: rbrow[4].x + eyeDist * 0.05, y: rbrow[4].y - eyeDist * 0.6 }], 60);
    const fWrinkle1 = ip([{ x: lbrow[0].x - eyeDist * 0.03, y: lbrow[0].y - eyeDist * 0.15 }, { x: nc.x, y: lbrow[2].y - eyeDist * 0.18 }, { x: rbrow[4].x + eyeDist * 0.03, y: rbrow[4].y - eyeDist * 0.15 }], 40);
    const fWrinkle2 = ip([{ x: lbrow[0].x, y: lbrow[0].y - eyeDist * 0.3 }, { x: nc.x, y: lbrow[2].y - eyeDist * 0.35 }, { x: rbrow[4].x, y: rbrow[4].y - eyeDist * 0.3 }], 40);
    const fWrinkle3 = ip([{ x: lbrow[0].x + eyeDist * 0.02, y: lbrow[0].y - eyeDist * 0.42 }, { x: nc.x, y: lbrow[2].y - eyeDist * 0.47 }, { x: rbrow[4].x - eyeDist * 0.02, y: rbrow[4].y - eyeDist * 0.42 }], 40);

    // === INNER FACE LINES ===
    const lInner = ip([lE[0], { x: lE[0].x - eyeDist * 0.02, y: (lE[0].y + jaw[3].y) / 2 }, jaw[3]], 50);
    const rInner = ip([rE[4], { x: rE[4].x + eyeDist * 0.02, y: (rE[4].y + jaw[13].y) / 2 }, jaw[13]], 50);
    const lMidCheek = ip([lE[2], { x: lE[2].x - eyeDist * 0.15, y: (lE[2].y + jaw[5].y) / 2 }, jaw[5]], 40);
    const rMidCheek = ip([rE[2], { x: rE[2].x + eyeDist * 0.15, y: (rE[2].y + jaw[11].y) / 2 }, jaw[11]], 40);
    const lOuterFace = ip([lbrow[0], { x: lbrow[0].x - eyeDist * 0.15, y: lbrow[0].y }, { x: jaw[0].x + eyeDist * 0.05, y: (jaw[0].y + jaw[2].y) / 2 }, jaw[2]], 50);
    const rOuterFace = ip([rbrow[4], { x: rbrow[4].x + eyeDist * 0.15, y: rbrow[4].y }, { x: jaw[16].x - eyeDist * 0.05, y: (jaw[16].y + jaw[14].y) / 2 }, jaw[14]], 50);

    // === TEMPORAL LINES ===
    const templeL = ip([lbrow[0], { x: lbrow[0].x - eyeDist * 0.2, y: lbrow[0].y - eyeDist * 0.12 }, { x: lbrow[0].x - eyeDist * 0.25, y: nc.y - eyeDist * 0.35 }], 40);
    const templeR = ip([rbrow[4], { x: rbrow[4].x + eyeDist * 0.2, y: rbrow[4].y - eyeDist * 0.12 }, { x: rbrow[4].x + eyeDist * 0.25, y: nc.y - eyeDist * 0.35 }], 40);

    // === UNDER-EYE BAGS ===
    const lUnderEye = ip([lE[0], { x: (lE[0].x + lE[3].x) / 2, y: lE[5].y + eyeDist * 0.06 }, lE[3]], 30);
    const rUnderEye = ip([rE[0], { x: (rE[0].x + rE[3].x) / 2, y: rE[5].y + eyeDist * 0.06 }, rE[3]], 30);

    // === NOSE (ultra detailed) ===
    const nBridge = ip([nBr[0], nBr[1], nBr[2], nBr[3], noseTip], 60);
    const nLSide = ip([nBr[3], nBt[0], nBt[1], noseBase], 40);
    const nRSide = ip([nBr[3], nBt[4], nBt[3], noseBase], 40);
    const nNostrL = ip([nBt[0], nBt[1], nBt[2]], 30);
    const nNostrR = ip([nBt[4], nBt[3], nBt[2]], 30);
    const nBottom = ip(nBt, 40);
    const nTipArc = ip([nBt[1], nBt[2], nBt[3]], 25);
    const nNostrCL = ip([nBr[3], nBt[0]], 15);
    const nNostrCR = ip([nBr[3], nBt[4]], 15);
    const nSeptum = ip([nBt[2], noseBase], 12);
    const nSideL2 = ip([{ x: nBr[3].x - eyeDist * 0.04, y: nBr[3].y }, nBt[0], { x: nBt[0].x - eyeDist * 0.02, y: nBt[0].y }], 20);
    const nSideR2 = ip([{ x: nBr[3].x + eyeDist * 0.04, y: nBr[3].y }, nBt[4], { x: nBt[4].x + eyeDist * 0.02, y: nBt[4].y }], 20);
    const nHL: { x: number; y: number }[][] = [];
    for (let i = 1; i <= 8; i++) {
      const t = i / 9;
      const li = Math.min(Math.floor(nLSide.length * t), nLSide.length - 1);
      const ri = Math.min(Math.floor(nRSide.length * t), nRSide.length - 1);
      nHL.push(ip([nLSide[li], nRSide[ri]], 10));
    }

    // === EYES (ultra detailed) ===
    const lEyeFull = ip([...lE, lE[0]], 120);
    const lLidU = ip([lE[0], lE[1], lE[2], lE[3]], 60);
    const lLidL = ip([lE[3], lE[4], lE[5], lE[0]], 60);
    const rEyeFull = ip([...rE, rE[0]], 120);
    const rLidU = ip([rE[0], rE[1], rE[2], rE[3]], 60);
    const rLidL = ip([rE[3], rE[4], rE[5], rE[0]], 60);
    const lCrease = ip([{ x: lE[0].x, y: lE[0].y - eyeDist * 0.07 }, lE[1], lE[2], { x: lE[3].x, y: lE[3].y - eyeDist * 0.07 }], 40);
    const rCrease = ip([{ x: rE[0].x, y: rE[0].y - eyeDist * 0.07 }, rE[1], rE[2], { x: rE[3].x, y: rE[3].y - eyeDist * 0.07 }], 40);

    const lECx = (lE[0].x + lE[3].x) / 2, lECy = (lE[1].y + lE[5].y) / 2;
    const rECx = (rE[0].x + rE[3].x) / 2, rECy = (rE[1].y + rE[5].y) / 2;
    const lEW = Math.hypot(lE[3].x - lE[0].x, lE[3].y - lE[0].y);
    const rEW = Math.hypot(rE[3].x - rE[0].x, rE[3].y - rE[0].y);
    const lIR = lEW * 0.3, rIR = rEW * 0.3;
    const lIris = circ(lECx, lECy, lIR, 48);
    const rIris = circ(rECx, rECy, rIR, 48);
    const lIrisR1 = circ(lECx, lECy, lIR * 0.55, 36);
    const rIrisR1 = circ(rECx, rECy, rIR * 0.55, 36);
    const lIrisR2 = circ(lECx, lECy, lIR * 0.8, 40);
    const rIrisR2 = circ(rECx, rECy, rIR * 0.8, 40);
    const lPupil = circ(lECx, lECy, lIR * 0.3, 24);
    const rPupil = circ(rECx, rECy, rIR * 0.3, 24);

    const mkSpokes = (cx: number, cy: number, r: number) => {
      const l: { x: number; y: number }[][] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        l.push([mapP({ x: cx + Math.cos(a) * r * 0.3, y: cy + Math.sin(a) * r * 0.3 }), mapP({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })]);
      }
      return l;
    };
    const lSpokes = mkSpokes(lECx, lECy, lIR), rSpokes = mkSpokes(rECx, rECy, rIR);

    const lECH = { h: [mapP({ x: lE[0].x - eyeDist * 0.07, y: lECy }), mapP({ x: lE[3].x + eyeDist * 0.07, y: lECy })], v: [mapP({ x: lECx, y: lE[1].y - eyeDist * 0.05 }), mapP({ x: lECx, y: lE[5].y + eyeDist * 0.05 })] };
    const rECH = { h: [mapP({ x: rE[0].x - eyeDist * 0.07, y: rECy }), mapP({ x: rE[3].x + eyeDist * 0.07, y: rECy })], v: [mapP({ x: rECx, y: rE[1].y - eyeDist * 0.05 }), mapP({ x: rECx, y: rE[5].y + eyeDist * 0.05 })] };

    // === EYEBROWS (triple line) ===
    const lbD = ip(lbrow, 70), rbD = ip(rbrow, 70);
    const lbU = ip([lbrow[0], { x: (lbrow[0].x + lbrow[2].x) / 2, y: lbrow[1].y - eyeDist * 0.12 }, lbrow[2], { x: (lbrow[2].x + lbrow[4].x) / 2, y: lbrow[3].y - eyeDist * 0.1 }, lbrow[4]], 50);
    const rbU = ip([rbrow[0], { x: (rbrow[0].x + rbrow[2].x) / 2, y: rbrow[1].y - eyeDist * 0.12 }, rbrow[2], { x: (rbrow[2].x + rbrow[4].x) / 2, y: rbrow[3].y - eyeDist * 0.1 }, rbrow[4]], 50);
    const lbL = ip([lbrow[0], { x: (lbrow[0].x + lbrow[2].x) / 2, y: lbrow[1].y + eyeDist * 0.025 }, lbrow[2], { x: (lbrow[2].x + lbrow[4].x) / 2, y: lbrow[3].y + eyeDist * 0.025 }, lbrow[4]], 50);
    const rbL = ip([rbrow[0], { x: (rbrow[0].x + rbrow[2].x) / 2, y: rbrow[1].y + eyeDist * 0.025 }, rbrow[2], { x: (rbrow[2].x + rbrow[4].x) / 2, y: rbrow[3].y + eyeDist * 0.025 }, rbrow[4]], 50);

    // === MOUTH (ultra detailed) ===
    const mOU = ip([mO[0], mO[1], mO[2], mO[3], mO[4], mO[5], mO[6]], 70);
    const mOL = ip([mO[6], mO[7], mO[8], mO[9], mO[10], mO[11], mO[0]], 70);
    const mIU = ip([mI[0], mI[1], mI[2], mI[3]], 40);
    const mIL = ip([mI[4], mI[5], mI[6], mI[7], mI[0]], 40);
    const mFull = ip([...mO, mO[0]], 100);
    const cupidBow = ip([mO[2], mO[3], mO[4], mO[5]], 40);
    const philtrum = ip([pts[51], noseBase], 25);
    const mHL: { x: number; y: number }[][] = [];
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      const ui = Math.min(Math.floor(mOU.length * t), mOU.length - 1);
      const li = Math.min(Math.floor(mOL.length * t), mOL.length - 1);
      mHL.push(ip([mOU[ui], mOL[li]], 12));
    }

    // === 3D MESH (30 rows x 24 cols) ===
    ctx.lineWidth = 0.2;
    for (let i = 1; i < 30; i++) {
      const t = i / 30;
      const fI = Math.min(Math.floor(foreheadD.length * t), foreheadD.length - 1);
      const cI = Math.min(Math.floor(chinD.length * t), chinD.length - 1);
      const top = foreheadD[fI], bot = chinD[cI];
      if (!top || !bot) continue;
      const lI = Math.min(Math.floor(lJawD.length * t), lJawD.length - 1);
      const rI = Math.min(Math.floor(rJawD.length * t), rJawD.length - 1);
      const left = lJawD[lI] || lCheekD[lI], right = rJawD[rI] || rCheekD[rI];
      if (!left || !right) continue;
      for (let j = 1; j < 24; j++) {
        const jt = j / 24;
        const lx = left.x + (top.x - left.x) * jt, ly = left.y + (top.y - left.y) * jt;
        const rx = right.x + (top.x - right.x) * jt, ry = right.y + (top.y - right.y) * jt;
        const d = 1 - Math.abs(jt - 0.5) * 2;
        ctx.strokeStyle = `rgba(0,180,255,${0.03 + d * 0.04})`;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
      }
    }
    for (let j = 1; j < 24; j++) {
      const t = j / 24;
      ctx.strokeStyle = 'rgba(0,180,255,0.035)';
      const col: { x: number; y: number }[] = [];
      for (let i = 0; i <= 30; i++) {
        const ht = i / 30;
        const fI = Math.min(Math.floor(foreheadD.length * ht), foreheadD.length - 1);
        const cI = Math.min(Math.floor(chinD.length * ht), chinD.length - 1);
        const fp = foreheadD[fI], cp = chinD[cI];
        if (fp && cp) col.push({ x: fp.x + (cp.x - fp.x) * t, y: fp.y + (cp.y - fp.y) * t });
      }
      if (col.length > 1) { ctx.beginPath(); ctx.moveTo(col[0].x, col[0].y); for (let k = 1; k < col.length; k++) ctx.lineTo(col[k].x, col[k].y); ctx.stroke(); }
    }

    // === DRAW LINES ===
    const L = (l: { x: number; y: number }[], c: string, w: number) => {
      if (l.length < 2) return;
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(l[0].x, l[0].y);
      for (let i = 1; i < l.length; i++) ctx.lineTo(l[i].x, l[i].y);
      ctx.stroke();
    };

    L(jawD, 'rgba(0,200,255,0.6)', 1.2); L(chinD, 'rgba(0,200,255,0.55)', 1.1);
    L(lJawD, 'rgba(0,200,255,0.55)', 1.1); L(rJawD, 'rgba(0,200,255,0.55)', 1.1);
    L(lCheekD, 'rgba(0,200,255,0.4)', 0.8); L(rCheekD, 'rgba(0,200,255,0.4)', 0.8);
    L(lCheekBone, 'rgba(100,220,255,0.55)', 0.9); L(rCheekBone, 'rgba(100,220,255,0.55)', 0.9);
    L(lNasoFold, 'rgba(0,220,200,0.5)', 0.8); L(rNasoFold, 'rgba(0,220,200,0.5)', 0.8);
    L(foreheadD, 'rgba(0,200,255,0.5)', 0.9); L(foreheadTop, 'rgba(0,200,255,0.35)', 0.7);
    L(fWrinkle1, 'rgba(0,200,255,0.25)', 0.5); L(fWrinkle2, 'rgba(0,200,255,0.2)', 0.45); L(fWrinkle3, 'rgba(0,200,255,0.15)', 0.4);
    L(lInner, 'rgba(0,200,255,0.4)', 0.7); L(rInner, 'rgba(0,200,255,0.4)', 0.7);
    L(lMidCheek, 'rgba(0,200,255,0.35)', 0.65); L(rMidCheek, 'rgba(0,200,255,0.35)', 0.65);
    L(lOuterFace, 'rgba(0,200,255,0.3)', 0.6); L(rOuterFace, 'rgba(0,200,255,0.3)', 0.6);
    L(templeL, 'rgba(0,200,255,0.35)', 0.6); L(templeR, 'rgba(0,200,255,0.35)', 0.6);

    L(nBridge, 'rgba(0,255,150,0.5)', 0.8); L(nLSide, 'rgba(0,255,150,0.4)', 0.6); L(nRSide, 'rgba(0,255,150,0.4)', 0.6);
    L(nNostrL, 'rgba(0,255,150,0.45)', 0.55); L(nNostrR, 'rgba(0,255,150,0.45)', 0.55);
    L(nBottom, 'rgba(0,255,150,0.35)', 0.5); L(nTipArc, 'rgba(0,255,200,0.5)', 0.7);
    L(nNostrCL, 'rgba(0,255,150,0.3)', 0.4); L(nNostrCR, 'rgba(0,255,150,0.3)', 0.4);
    L(nSeptum, 'rgba(0,255,150,0.25)', 0.35); L(nSideL2, 'rgba(0,255,150,0.2)', 0.3); L(nSideR2, 'rgba(0,255,150,0.2)', 0.3);
    for (const hl of nHL) L(hl, 'rgba(0,255,150,0.08)', 0.25);

    L(lLidU, 'rgba(255,80,80,0.6)', 1.0); L(lLidL, 'rgba(255,80,80,0.6)', 1.0);
    L(rLidU, 'rgba(255,80,80,0.6)', 1.0); L(rLidL, 'rgba(255,80,80,0.6)', 1.0);
    L(lCrease, 'rgba(255,60,60,0.2)', 0.35); L(rCrease, 'rgba(255,60,60,0.2)', 0.35);
    L(lUnderEye, 'rgba(255,80,80,0.35)', 0.5); L(rUnderEye, 'rgba(255,80,80,0.35)', 0.5);
    L(lIris, 'rgba(255,120,120,0.5)', 0.7); L(rIris, 'rgba(255,120,120,0.5)', 0.7);
    L(lIrisR1, 'rgba(255,100,100,0.25)', 0.4); L(rIrisR1, 'rgba(255,100,100,0.25)', 0.4);
    L(lIrisR2, 'rgba(255,100,100,0.3)', 0.45); L(rIrisR2, 'rgba(255,100,100,0.3)', 0.45);
    L(lPupil, 'rgba(255,150,150,0.65)', 0.8); L(rPupil, 'rgba(255,150,150,0.65)', 0.8);
    for (const s of lSpokes) L(s, 'rgba(255,100,100,0.18)', 0.2);
    for (const s of rSpokes) L(s, 'rgba(255,100,100,0.18)', 0.2);
    L(lECH.h, 'rgba(255,200,200,0.12)', 0.2); L(lECH.v, 'rgba(255,200,200,0.12)', 0.2);
    L(rECH.h, 'rgba(255,200,200,0.12)', 0.2); L(rECH.v, 'rgba(255,200,200,0.12)', 0.2);

    L(lbD, 'rgba(255,100,100,0.45)', 0.7); L(rbD, 'rgba(255,100,100,0.45)', 0.7);
    L(lbU, 'rgba(255,100,100,0.25)', 0.4); L(rbU, 'rgba(255,100,100,0.25)', 0.4);
    L(lbL, 'rgba(255,100,100,0.2)', 0.35); L(rbL, 'rgba(255,100,100,0.2)', 0.35);

    L(mOU, 'rgba(255,180,50,0.5)', 0.8); L(mOL, 'rgba(255,180,50,0.5)', 0.8);
    L(mIU, 'rgba(255,140,30,0.3)', 0.5); L(mIL, 'rgba(255,140,30,0.3)', 0.5);
    L(mFull, 'rgba(255,180,50,0.15)', 0.3); L(cupidBow, 'rgba(255,200,80,0.4)', 0.55);
    L(philtrum, 'rgba(255,180,50,0.2)', 0.35);
    for (const hl of mHL) L(hl, 'rgba(255,180,50,0.06)', 0.2);

    // === 68 LANDMARKS ===
    const mapped = pts.map(mapP);
    for (let i = 0; i < mapped.length; i++) {
      const p = mapped[i];
      const dx = (pts[i].x - nc.x) / eyeDist, dy = (pts[i].y - nc.y) / eyeDist;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const d = Math.max(0, 1 - distFromCenter * 0.25);
      const sz = 1.2 + d * 1.2;
      let c: string;
      if (i >= 36 && i <= 47) c = `rgba(255,80,80,${0.7 + d * 0.3})`;
      else if (i >= 27 && i <= 35) c = `rgba(0,255,150,${0.7 + d * 0.3})`;
      else if (i >= 48 && i <= 67) c = `rgba(255,180,50,${0.7 + d * 0.3})`;
      else if (i <= 16) c = `rgba(0,220,255,${0.8 + d * 0.2})`;
      else c = `rgba(180,200,255,${0.6 + d * 0.4})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      if (d > 0.5) { ctx.beginPath(); ctx.arc(p.x, p.y, sz + 2.2, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,255,200,${0.3 * d})`; ctx.fill(); }
    }

    // === CROSSHAIR + DISTANCE LABEL ===
    const eMid = mapP(nc), cP = mapP(pts[8]);
    ctx.strokeStyle = 'rgba(255,255,0,0.1)'; ctx.lineWidth = 0.35; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(eMid.x - eyeDist * sx * 0.75, eMid.y); ctx.lineTo(eMid.x + eyeDist * sx * 0.75, eMid.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(eMid.x, eMid.y - eyeDist * sy * 0.55); ctx.lineTo(cP.x, cP.y + eyeDist * sy * 0.12); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,255,200,0.5)'; ctx.font = `${Math.max(8, eyeDist * 0.11)}px monospace`; ctx.textAlign = 'center';
    ctx.fillText(`${distLabel} ${(faceAR * 100).toFixed(1)}%`, eMid.x, cP.y + eyeDist * sy * 0.22);

    ctx.restore();
  }, [phase]);

  const calculateGeometry = useCallback((landmarks: faceapi.FaceLandmarks68, videoW: number, videoH: number): FaceGeometry => {
    const pts = landmarks.positions;
    const leftEye = pts[36], rightEye = pts[45], noseTip = pts[30], noseBridge = pts[27], chin = pts[8];
    const leftMouth = pts[48], rightMouth = pts[54], leftJaw = pts[0], rightJaw = pts[16];

    const interEyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
    const noseLength = Math.sqrt((noseTip.x - noseBridge.x) ** 2 + (noseTip.y - noseBridge.y) ** 2);
    const mouthWidth = Math.sqrt((rightMouth.x - leftMouth.x) ** 2 + (rightMouth.y - leftMouth.y) ** 2);
    const jawWidth = Math.sqrt((rightJaw.x - leftJaw.x) ** 2 + (rightJaw.y - leftJaw.y) ** 2);
    const faceHeight = Math.sqrt((chin.x - noseBridge.x) ** 2 + (chin.y - noseBridge.y) ** 2);
    const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
    const centerX = (leftEye.x + rightEye.x) / 2;
    const noseOffsetNorm = (noseTip.x - centerX) / (interEyeDist || 1);
    const faceArea = jawWidth * faceHeight;
    const imageArea = videoW * videoH;
    const faceRatio = faceArea / imageArea;
    let distance = 'optimo';
    if (faceRatio < 0.03) distance = 'muy_lejos';
    else if (faceRatio < 0.06) distance = 'lejos';
    else if (faceRatio > 0.15) distance = 'muy_cerca';
    else if (faceRatio > 0.10) distance = 'cerca';
    const probability = ((1 - Math.abs(noseOffsetNorm)) * 0.3 + Math.min(1, faceRatio / 0.08) * 0.3 + (1 - Math.abs(noseOffsetNorm * 45) / 45) * 0.4);

    return {
      interEyeDist: Math.round(interEyeDist), noseLength: Math.round(noseLength),
      mouthWidth: Math.round(mouthWidth), jawWidth: Math.round(jawWidth),
      faceWidth: Math.round(jawWidth), faceHeight: Math.round(faceHeight),
      eyeAngle: Math.round(eyeAngle * 10) / 10, noseOffsetNorm: Math.round(noseOffsetNorm * 1000) / 1000,
      probability: Math.round(probability * 1000) / 1000, distance,
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setStatusMsg('Cargando modelos de IA...');
        await loadFaceModels();
        setStatusMsg('Accediendo a la camara...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setPhase('scanning');
        setStatusMsg(`Posicion: ${ANGLES[0].instruction}`);
      } catch (err: any) {
        if (!alive) return;
        const msg = err?.message || err?.name || String(err);
        console.error('[FaceCapture] Init error:', err);
        if (err?.name === 'NotAllowedError') {
          setErrorMsg('Permiso de camara denegado. Permite el acceso a la camara en tu navegador.');
        } else if (msg.includes('model') || msg.includes('load') || msg.includes('fetch')) {
          setErrorMsg('Error cargando modelos de IA. Verifica tu conexion a internet.');
        } else {
          setErrorMsg(`Error: ${msg}`);
        }
        setPhase('error');
      }
    })();
    return () => { alive = false; stopAll(); };
  }, [stopAll, mode]);

  useEffect(() => {
    if ((phase === 'scanning' || phase === 'countdown') && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'scanning') return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    goodFramesRef.current = 0;
    scanFramesRef.current = 0;
    setReadyToCapture(false);
    frozenRef.current = null;
    scanStartTimeRef.current = Date.now();

    let alive = true;
    let detectionCount = 0;
    let lastError = '';
    intervalRef.current = setInterval(async () => {
      if (!alive || !video || video.readyState < 2) return;

      try {
        const detector = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.1 });
        const detections = await (faceapi as any)
          .detectSingleFace(video, detector)
          .withFaceLandmarks();

        detectionCount++;
        if (detectionCount <= 5 || detectionCount % 20 === 0) {
          console.log(`[FaceCapture] Detection #${detectionCount}:`, detections ? `score=${detections.detection.score.toFixed(3)}, landmarks=${detections.landmarks.positions.length}` : 'null');
        }

        if (!detections) {
          setMultiFace(false);
          setStatusMsg(mode === 'login' ? 'Buscando tu rostro...' : 'Coloque su rostro frente a la camara');
          setQuality(null);
          setFaceGeometry(null);
          goodFramesRef.current = 0;
          scanFramesRef.current = 0;
          setReadyToCapture(false);
          setScanProgress(0);
          setScanPhase('init');
          frozenRef.current = null;
          const overlay = overlayRef.current;
          if (overlay) { const ctx = overlay.getContext('2d'); if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height); }
          return;
        }

        setMultiFace(false);
        const videoW = video.videoWidth || video.clientWidth;
        const videoH = video.videoHeight || video.clientHeight;
        const overlay = overlayRef.current;
        if (overlay && videoW > 0 && videoH > 0) {
          const cw = overlay.clientWidth || videoW;
          const ch = overlay.clientHeight || videoH;
          overlay.width = cw;
          overlay.height = ch;
          try { drawWireframeMask(detections.landmarks, videoW, videoH, cw, ch); } catch (e) { console.error('[FaceCapture] drawWireframeMask error:', e); }
        }

        frozenRef.current = { landmarks: detections.landmarks, score: detections.detection.score, videoW, videoH };

        const pts = detections.landmarks.positions;
        const leftEye = pts[36], rightEye = pts[45], nose = pts[30];
        const centerX = (leftEye.x + rightEye.x) / 2;
        const eyeDist = Math.abs(rightEye.x - leftEye.x);
        const noseOffset = eyeDist > 0 ? -(nose.x - centerX) / eyeDist : 0;

        const angle = ANGLES[angleRef.current]?.key as 'frontal' | 'izquierda' | 'derecha';
        let isAngleOk = true;
        if (angle === 'frontal') isAngleOk = Math.abs(noseOffset) < 0.4;
        else if (angle === 'izquierda') isAngleOk = noseOffset > 0.05;
        else if (angle === 'derecha') isAngleOk = noseOffset < -0.05;

        const isCentered = Math.abs(noseOffset) < 0.4;
        const detScore = detections.detection.score;
        const noseToEye = Math.sqrt((nose.x - centerX) ** 2 + (nose.y - (leftEye.y + rightEye.y) / 2) ** 2);
        const faceRatio = eyeDist > 0 ? noseToEye / eyeDist : 0;

        let brightness = 128;
        try {
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = 64; tmpCanvas.height = 48;
          const tmpCtx = tmpCanvas.getContext('2d');
          if (tmpCtx) {
            tmpCtx.drawImage(video, 0, 0, 64, 48);
            const imgData = tmpCtx.getImageData(0, 0, 64, 48).data;
            let sum = 0;
            for (let i = 0; i < imgData.length; i += 4) sum += (imgData[i] + imgData[i+1] + imgData[i+2]) / 3;
            brightness = sum / (imgData.length / 4);
          }
        } catch {}
        const isGoodBrightness = brightness > 35 && brightness < 225;

        let score = 0;
        if (detScore > 0.15) score += 0.35;
        if (isCentered) score += 0.25;
        if (isAngleOk) score += 0.2;
        if (faceRatio > 0.08 && faceRatio < 2.5) score += 0.1;
        if (isGoodBrightness) score += 0.1;

        const isGood = detScore > 0.15 && isAngleOk && isCentered && faceRatio > 0.08 && faceRatio < 2.5 && isGoodBrightness && score >= 0.6;

        if (mode === 'login') {
          const elapsed = Date.now() - scanStartTimeRef.current;
          const SCAN_MIN_MS = 3000;
          const SCAN_TARGET_MS = 4500;

          if (isGood) {
            scanFramesRef.current++;
            const progress = Math.min(1, elapsed / SCAN_TARGET_MS);
            setScanProgress(progress);

            if (elapsed < SCAN_MIN_MS) {
              const secsLeft = Math.ceil((SCAN_MIN_MS - elapsed) / 1000);
              setScanPhase('scanning');
              setStatusMsg(`Escaneando rostro... ${secsLeft}s`);
              setQuality({ detected: true, centered: true, angleOk: true, score, probability: score, confidence: detScore, message: 'Escaneando', brightness, blur: 50, size: 1, noseOffset, faceRatio, eyeDistance: eyeDist });
            } else if (elapsed >= SCAN_MIN_MS && elapsed < SCAN_TARGET_MS) {
              const secsLeft = Math.ceil((SCAN_TARGET_MS - elapsed) / 1000);
              setScanPhase('analyzing');
              setStatusMsg(`Analizando geometria... ${secsLeft}s`);
              setQuality({ detected: true, centered: true, angleOk: true, score, probability: score, confidence: detScore, message: 'Analizando', brightness, blur: 50, size: 1, noseOffset, faceRatio, eyeDistance: eyeDist });
            } else {
              setScanPhase('ready');
              setStatusMsg('Identidad verificada - Procesando...');
              setQuality({ detected: true, centered: true, angleOk: true, score, probability: score, confidence: detScore, message: 'Capturando', brightness, blur: 50, size: 1, noseOffset, faceRatio, eyeDistance: eyeDist });

              goodFramesRef.current++;
              if (goodFramesRef.current >= 3) {
                goodFramesRef.current = 0;
                alive = false;
                if (intervalRef.current) clearInterval(intervalRef.current);
                setTimeout(() => startCaptureRef.current(), 300);
                return;
              }
            }
          } else {
            scanFramesRef.current = Math.max(0, scanFramesRef.current - 1);
            if (elapsed < 1500) {
              setScanPhase('finding');
              setStatusMsg('Buscando tu rostro...');
            } else {
              setScanPhase('adjust');
              setStatusMsg('Ajusta tu posicion...');
            }
            setScanProgress(Math.max(0, elapsed / SCAN_TARGET_MS * 0.5));
            setQuality({ detected: detScore > 0.15, centered: isCentered, angleOk: isAngleOk, score, probability: score, confidence: detScore, message: 'Ajustar', brightness, blur: 50, size: 1, noseOffset, faceRatio, eyeDistance: eyeDist });
          }
        } else {
          let message = 'Detectando...';
          if (detScore <= 0.15) message = 'Buscando rostro...';
          else if (!isGoodBrightness) message = brightness < 35 ? 'Muy oscuro' : 'Muy brillante';
          else if (!isCentered) message = 'Centra tu cara';
          else if (!isAngleOk) message = angle === 'frontal' ? 'Mira de frente' : 'Gira un poco mas';
          else if (faceRatio <= 0.08) message = 'Acercate a la camara';
          else if (faceRatio >= 2.5) message = 'Alejate un poco';
          else message = 'Listo para capturar';

          setQuality({ detected: detScore > 0.15, centered: isCentered, angleOk: isAngleOk, score, probability: score, confidence: detScore, message, brightness, blur: 50, size: 1, noseOffset, faceRatio, eyeDistance: eyeDist });

          if (phaseRef.current === 'scanning') {
            if (isGood) {
              goodFramesRef.current++;
              setStatusMsg(message);
              if (goodFramesRef.current >= 2) {
                goodFramesRef.current = 0;
                setReadyToCapture(true);
                setStatusMsg('Rostro listo - Presiona el boton');
              }
            } else {
              goodFramesRef.current = Math.max(0, goodFramesRef.current - 1);
              setReadyToCapture(false);
              setStatusMsg(message);
            }
          }
        }

        const geom = calculateGeometry(detections.landmarks, videoW, videoH);
        setFaceGeometry(geom);
        const pts2d: Point2D[] = pts.map((p: any) => ({ x: p.x, y: p.y }));
        setFaceSig(generateFaceSignature(pts2d));
      } catch {}
    }, 250);

    return () => { alive = false; if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, drawWireframeMask, calculateGeometry, mode]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const frozen = frozenRef.current;
    if (!frozen) return;
    const overlay = overlayRef.current;
    if (overlay) {
      const cw = overlay.clientWidth || frozen.videoW;
      const ch = overlay.clientHeight || frozen.videoH;
      if (cw > 0 && ch > 0) {
        overlay.width = cw;
        overlay.height = ch;
        drawWireframeMask(frozen.landmarks, frozen.videoW, frozen.videoH, cw, ch);
      }
    }
  }, [phase, countdown, drawWireframeMask]);

  const startCapture = useCallback(() => {
    setPhase('countdown');
    let c = 3;
    setCountdown(c);
    const tick = async () => {
      c--;
      if (c <= 0) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0);
        const photo = canvas.toDataURL('image/jpeg', 0.95);
        const angleIdx = angleRef.current;
        const ang = ANGLES[angleIdx];
        const newPhotos = { ...photosRef.current, [ang.key]: photo };
        photosRef.current = newPhotos; setCapturedPhotos(newPhotos); setStatusMsg(`${ang.label} capturada!`); setCountdown(0);
        timerRef.current = setTimeout(() => {
          if (angleIdx < ANGLES.length - 1) {
            setCurrentAngle(angleIdx + 1); goodFramesRef.current = 0; setReadyToCapture(false); frozenRef.current = null;
            setPhase('scanning'); setStatusMsg(`Posicion: ${ANGLES[angleIdx + 1].instruction}`);
          } else if (mode === 'login') { doLoginRef.current(newPhotos); }
          else if (mode === 'register' && usuarioId) { setPhase('processing'); doRegister(newPhotos); }
          else { setPhase('done'); setSuccessMsg('Fotos capturadas correctamente'); stopAll(); if (onCapture) onCapture(newPhotos); }
        }, 800);
        return;
      }
      setCountdown(c);
      timerRef.current = setTimeout(tick, 700);
    };
    timerRef.current = setTimeout(tick, 700);
  }, [mode, onCapture, usuarioId, stopAll]);

  startCaptureRef.current = startCapture;
  const handleManualCapture = useCallback(() => { if (!readyToCapture) return; setReadyToCapture(false); startCaptureRef.current(); }, [readyToCapture]);

  const doRegister = useCallback(async (photos: Record<string, string>) => {
    setPhase('processing');
    try {
      setStatusMsg('Enviando al servidor...');
      const result = await faceApiRegister(usuarioId!, photos);
      if (!result.ok) { setErrorMsg(result.error || 'Error registrando rostro'); setPhase('error'); return; }
      setSuccessMsg('Rostro registrado correctamente'); setPhase('done'); stopAll(); if (onCapture) onCapture(photos);
    } catch { setErrorMsg('Error de conexion con el servidor'); setPhase('error'); }
  }, [usuarioId, onCapture, stopAll]);

  const doLogin = useCallback(async (photos: Record<string, string>) => {
    setPhase('processing');
    try {
      setStatusMsg('Verificando identidad...');
      const result = await faceApiLogin(photos);
      if (!result.ok) { setErrorMsg(result.error || 'Rostro no reconocido'); setPhase('error'); return; }
      setSuccessMsg(`Bienvenido ${result.nombre}`); setPhase('done'); stopAll(); if (onLoginMatch) onLoginMatch(result.usuario_id!, result.nombre!);
    } catch { setErrorMsg('Error de conexion con el servidor'); setPhase('error'); }
  }, [onLoginMatch, stopAll]);

  doLoginRef.current = doLogin;
  const handleClose = () => { stopAll(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">{mode === 'register' ? 'Registro Facial' : 'Verificacion de Identidad'}</h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="p-5">
          {phase === 'loading' && (<div className="flex flex-col items-center py-12 gap-3"><Loader2 size={32} className="animate-spin text-blue-600" /><p className="text-sm text-slate-500">Cargando modelos de seguridad...</p></div>)}
          {phase === 'error' && (<div className="flex flex-col items-center py-8 gap-4"><AlertCircle size={28} className="text-red-500" /><p className="text-sm text-red-600 text-center">{errorMsg}</p><button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700">Cerrar</button></div>)}
          {phase === 'processing' && (<div className="flex flex-col items-center py-12 gap-3"><Loader2 size={32} className="animate-spin text-blue-600" /><p className="text-sm text-slate-500">{statusMsg}</p></div>)}
          {(phase === 'scanning' || phase === 'countdown') && (
            <>
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }} />
                {phase === 'countdown' && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10"><span className="text-8xl font-bold text-white drop-shadow-lg animate-pulse">{countdown}</span></div>
                )}
                {mode === 'login' && (phase === 'scanning' || phase === 'countdown') && (
                  <div className="absolute inset-0 pointer-events-none z-6">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(0,255,200,0)" />
                          <stop offset="50%" stopColor="rgba(0,255,200,0.3)" />
                          <stop offset="100%" stopColor="rgba(0,255,200,0)" />
                        </linearGradient>
                      </defs>
                      <rect x="0" y={scanProgress * 100} width="100" height="8" fill="url(#scanGrad)" className="transition-all duration-300" />
                      <line x1="0" y1={scanProgress * 100} x2="100" y2={scanProgress * 100} stroke="rgba(0,255,200,0.6)" strokeWidth="0.3" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                  <div className="bg-black/60 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${quality?.detected ? 'bg-green-400' : 'bg-red-400'}`} /><span className="text-white text-xs">{quality?.detected ? 'Rostro detectado' : 'Buscando rostro...'}</span></div>
                    <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${quality?.centered ? 'bg-green-400' : 'bg-yellow-400'}`} /><span className="text-white text-xs">{quality?.centered ? 'Centrado' : 'Centra tu cara'}</span></div>
                    <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${quality?.angleOk ? 'bg-green-400' : 'bg-blue-400'}`} /><span className="text-white text-xs">{quality?.angleOk ? 'Angulo OK' : 'Ajusta angulo'}</span></div>
                    {quality?.detected && (<div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${quality.probability > 0.7 ? 'bg-green-400' : quality.probability > 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`} /><span className="text-white text-xs">Prob: {(quality.probability * 100).toFixed(0)}%</span></div>)}
                  </div>
                  {mode === 'register' && <div className="bg-black/60 rounded-lg px-2 py-1"><span className="text-white text-xs font-bold">{currentAngle + 1}/3</span></div>}
                  {mode === 'login' && (
                    <div className="bg-black/60 rounded-lg px-3 py-2 text-right">
                      <div className="text-xs text-cyan-300 font-bold uppercase tracking-wider">{scanPhase === 'init' ? 'Inicializando' : scanPhase === 'finding' ? 'Buscando' : scanPhase === 'scanning' ? 'Escaneando' : scanPhase === 'analyzing' ? 'Analizando' : scanPhase === 'ready' ? 'Listo' : scanPhase === 'adjust' ? 'Ajustar' : 'Detectando'}</div>
                      <div className="text-white text-lg font-bold mt-0.5">{Math.round(scanProgress * 100)}%</div>
                    </div>
                  )}
                </div>
                {mode === 'register' && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="flex gap-1">{ANGLES.map((a, i) => (<div key={a.key} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${i < currentAngle ? 'bg-green-500 text-white' : i === currentAngle ? 'bg-blue-500 text-white' : 'bg-white/20 text-white/60'}`}>{i < currentAngle ? '✓' : a.label}</div>))}</div>
                  </div>
                )}
                {multiFace && (<div className="absolute inset-0 flex items-center justify-center bg-red-500/30 z-20"><div className="bg-red-500 rounded-2xl px-6 py-3 flex items-center gap-2"><AlertCircle size={24} className="text-white" /><span className="text-white text-lg font-bold">Solo una persona</span></div></div>)}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10">
                  <div className="bg-black/60 rounded-xl px-5 py-3 text-center max-w-xs">
                    <p className="text-white text-base font-bold">{statusMsg}</p>
                    <p className="text-white/70 text-xs mt-1">{mode === 'login' ? (scanPhase === 'scanning' ? 'Mantente quieto mientras escaneamos' : scanPhase === 'analyzing' ? 'Analizando rasgos faciales' : 'Posiciona tu rostro frente a la camara') : (phase === 'countdown' ? 'Mantente quieto...' : (currentAngle === 0 ? 'Mira de frente' : currentAngle === 1 ? 'Gira a la derecha' : 'Gira a la izquierda'))}</p>
                  </div>
                </div>
              </div>
              {faceGeometry && (<div className="mt-2 grid grid-cols-4 gap-1 text-[10px] text-slate-500"><div className="bg-slate-50 rounded px-2 py-1 text-center"><div className="font-bold text-slate-700">Ojos</div><div>{faceGeometry.interEyeDist}px</div></div><div className="bg-slate-50 rounded px-2 py-1 text-center"><div className="font-bold text-slate-700">Nariz</div><div>{faceGeometry.noseLength}px</div></div><div className="bg-slate-50 rounded px-2 py-1 text-center"><div className="font-bold text-slate-700">Boca</div><div>{faceGeometry.mouthWidth}px</div></div><div className="bg-slate-50 rounded px-2 py-1 text-center"><div className="font-bold text-slate-700">Dist</div><div>{faceGeometry.distance}</div></div></div>)}
              {faceSig && (<div className="mt-1 grid grid-cols-5 gap-1 text-[9px] text-slate-400">{faceSig.ratios.slice(0, 5).map((r, i) => (<div key={`r${i}`} className="bg-blue-50 rounded px-1 py-0.5 text-center"><div className="font-bold text-blue-600">R{i+1}</div><div>{r.toFixed(3)}</div></div>))}{faceSig.angles.slice(0, 5).map((a, i) => (<div key={`a${i}`} className="bg-green-50 rounded px-1 py-0.5 text-center"><div className="font-bold text-green-600">A{i+1}</div><div>{a.toFixed(1)}°</div></div>))}</div>)}
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  {mode === 'login' ? (
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${scanProgress * 100}%`, background: scanProgress < 0.3 ? 'linear-gradient(90deg, #3b82f6, #06b6d4)' : scanProgress < 0.7 ? 'linear-gradient(90deg, #06b6d4, #10b981)' : 'linear-gradient(90deg, #10b981, #22c55e)' }} />
                  ) : (
                    <div className={`h-full rounded-full transition-all duration-300 ${phase === 'countdown' ? 'bg-green-500' : (quality?.score || 0) >= 0.6 ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: phase === 'countdown' ? '100%' : `${Math.min(80, (quality?.score || 0) * 100)}%` }} />
                  )}
                </div>
                <span className="text-xs text-slate-500 font-mono w-16 text-right">{mode === 'login' ? `${Math.round(scanProgress * 100)}%` : (phase === 'countdown' ? 'Capturando' : `${Math.round((quality?.score || 0) * 100)}%`)}</span>
              </div>
              {mode === 'login' && scanProgress > 0 && (
                <div className="mt-2 flex items-center justify-center gap-3 text-[10px]">
                  <div className={`flex items-center gap-1 ${scanProgress >= 0.3 ? 'text-emerald-500' : 'text-slate-400'}`}><div className={`w-1.5 h-1.5 rounded-full ${scanProgress >= 0.3 ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span>Deteccion</span></div>
                  <div className={`w-6 h-px ${scanProgress >= 0.3 ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <div className={`flex items-center gap-1 ${scanProgress >= 0.6 ? 'text-emerald-500' : 'text-slate-400'}`}><div className={`w-1.5 h-1.5 rounded-full ${scanProgress >= 0.6 ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span>Escaneo</span></div>
                  <div className={`w-6 h-px ${scanProgress >= 0.6 ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <div className={`flex items-center gap-1 ${scanProgress >= 1 ? 'text-emerald-500' : 'text-slate-400'}`}><div className={`w-1.5 h-1.5 rounded-full ${scanProgress >= 1 ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span>Verificado</span></div>
                </div>
              )}
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-400">
                <div className="flex items-center gap-1"><Eye size={12} /><span>200+ puntos</span></div>
                <div className="flex items-center gap-1"><Scan size={12} /><span>Wireframe 3D</span></div>
                {faceSig && <span className="text-[9px] text-cyan-400">{mode === 'login' ? 'Escaneo activo' : 'Mascara activa'}</span>}
              </div>
              {mode === 'register' && (
                <div className="mt-3">
                  <button onClick={handleManualCapture} disabled={!readyToCapture} className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all ${readyToCapture ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 active:scale-95' : 'bg-slate-300 cursor-not-allowed text-slate-500'}`}>
                    {readyToCapture ? 'Capturar Rostro' : 'Ajusta tu posicion...'}
                  </button>
                  {readyToCapture && <p className="text-center text-[10px] text-emerald-600 mt-1 font-medium animate-pulse">Rostro detectado correctamente</p>}
                </div>
              )}
            </>
          )}
          {phase === 'done' && (<div className="flex flex-col items-center py-8 gap-3"><CheckCircle size={28} className="text-emerald-500" /><p className="text-sm text-emerald-700 font-medium">{successMsg || 'Completado!'}</p><button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 mt-2">Cerrar</button></div>)}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
