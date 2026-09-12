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
    const sx = canvasW / videoW;
    const sy = canvasH / videoH;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasW, 0);

    const pts = landmarks.positions;
    const le36 = pts[36], le45 = pts[45];
    const eyeDist = Math.hypot(le45.x - le36.x, le45.y - le36.y);
    const nc = { x: (le36.x + le45.x) / 2, y: (le36.y + le45.y) / 2 };
    const fcx = canvasW / 2, fcy = canvasH / 2;

    const m = (p: { x: number; y: number }) => ({
      x: (p.x - nc.x) * sx + fcx,
      y: (p.y - nc.y) * sy + fcy,
    });

    const ip = (pts: { x: number; y: number }[], n: number) => {
      if (pts.length < 2) return pts.map(m);
      const r: { x: number; y: number }[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const steps = Math.max(1, Math.floor(n / pts.length));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          r.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      r.push(pts[pts.length - 1]);
      return r.map(m);
    };

    const depth = (p: { x: number; y: number }) => {
      const dx = (p.x - nc.x) / eyeDist, dy = (p.y - nc.y) / eyeDist;
      return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 0.35);
    };

    const jaw = pts.slice(0, 17);
    const lbrow = pts.slice(17, 22);
    const rbrow = pts.slice(22, 27);
    const nBridge = pts.slice(27, 31);
    const nBottom = pts.slice(31, 36);
    const lEye = pts.slice(36, 42);
    const rEye = pts.slice(42, 48);
    const mOuter = pts.slice(48, 60);
    const mInner = pts.slice(60, 68);

    const noseTip = pts[30], noseBase = pts[33], noseLeft = pts[31], noseRight = pts[35];
    const lipL = pts[48], lipR = pts[54], lipTop = pts[51], lipBot = pts[57];

    // === CONTOUR DENSITIES (high count for precision) ===
    const jawD = ip(jaw, 60);
    const chinD = ip([jaw[5], jaw[6], jaw[7], jaw[8], jaw[9], jaw[10], jaw[11]], 40);
    const leftJawD = ip([jaw[0], jaw[1], jaw[2], jaw[3], jaw[4], jaw[5]], 30);
    const rightJawD = ip([jaw[11], jaw[12], jaw[13], jaw[14], jaw[15], jaw[16]], 30);

    // Cheek contours (jaw to eye area)
    const lCheekD = ip([jaw[2], jaw[3], jaw[4], lEye[0], lbrow[0]], 24);
    const rCheekD = ip([jaw[12], jaw[13], jaw[14], rEye[4], rbrow[4]], 24);

    // Forehead
    const foreheadD = ip([lbrow[0], lbrow[1], lbrow[2], { x: nc.x, y: lbrow[2].y - eyeDist * 0.5 }, rbrow[2], rbrow[3], rbrow[4]], 28);

    // Inner face vertical lines (cheek to jaw)
    const lInnerFace = ip([lEye[0], { x: lEye[0].x, y: (lEye[0].y + jaw[3].y) / 2 }, jaw[3]], 16);
    const rInnerFace = ip([rEye[4], { x: rEye[4].x, y: (rEye[4].y + jaw[13].y) / 2 }, jaw[13]], 16);

    // === NOSE (detailed) ===
    const noseBridgeL = ip([nBridge[0], nBridge[1], nBridge[2], nBridge[3], noseTip], 20);
    const noseBridgeR = ip([nBridge[0], nBridge[1], nBridge[2], nBridge[3], noseTip], 20);
    const noseLeftSide = ip([nBridge[3], nBottom[0], nBottom[1], noseBase], 16);
    const noseRightSide = ip([nBridge[3], nBottom[4], nBottom[3], noseBase], 16);
    const noseNostrilL = ip([nBottom[0], nBottom[1], nBottom[2]], 12);
    const noseNostrilR = ip([nBottom[4], nBottom[3], nBottom[2]], 12);
    const noseBottomD = ip(nBottom, 16);
    const noseTipArc = ip([nBottom[1], nBottom[2], nBottom[3]], 10);

    // Nose horizontal lines (3D mesh)
    const noseHLines: { x: number; y: number }[][] = [];
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const li = Math.min(Math.floor(noseLeftSide.length * t), noseLeftSide.length - 1);
      const ri = Math.min(Math.floor(noseRightSide.length * t), noseRightSide.length - 1);
      noseHLines.push([noseLeftSide[li], noseRightSide[ri]]);
    }

    // === EYES (detailed contours) ===
    const lEyeUpper = ip([...lEye.slice(0, 3), lEye[2]], 20);
    const lEyeLower = ip([lEye[0], ...lEye.slice(4), lEye[3]], 20);
    const lEyeFull = ip([...lEye, lEye[0]], 30);
    const rEyeUpper = ip([...rEye.slice(0, 3), rEye[2]], 20);
    const rEyeLower = ip([rEye[0], ...rEye.slice(4), rEye[3]], 20);
    const rEyeFull = ip([...rEye, rEye[0]], 30);

    // Eye inner structure (iris estimate from eye center)
    const lEyeCenter = { x: (lEye[0].x + lEye[3].x) / 2, y: (lEye[1].y + lEye[5].y) / 2 };
    const rEyeCenter = { x: (rEye[0].x + rEye[3].x) / 2, y: (rEye[1].y + rEye[5].y) / 2 };
    const lIrisR = eyeDist * 0.12;
    const rIrisR = eyeDist * 0.12;
    const irisPts = (cx: number, cy: number, r: number, n: number) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(m({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }));
      }
      return pts;
    };
    const lIrisD = irisPts(lEyeCenter.x, lEyeCenter.y, lIrisR, 16);
    const rIrisD = irisPts(rEyeCenter.x, rEyeCenter.y, rIrisR, 16);
    const lPupilD = irisPts(lEyeCenter.x, lEyeCenter.y, lIrisR * 0.4, 10);
    const rPupilD = irisPts(rEyeCenter.x, rEyeCenter.y, rIrisR * 0.4, 10);

    // Eye cross lines (gaze direction)
    const lEyeH = [m({ x: lEye[0].x - eyeDist * 0.05, y: lEyeCenter.y }), m({ x: lEye[3].x + eyeDist * 0.05, y: lEyeCenter.y })];
    const lEyeV = [m({ x: lEyeCenter.x, y: lEye[1].y - eyeDist * 0.03 }), m({ x: lEyeCenter.x, y: lEye[4].y + eyeDist * 0.03 })];
    const rEyeH = [m({ x: rEye[0].x - eyeDist * 0.05, y: rEyeCenter.y }), m({ x: rEye[3].x + eyeDist * 0.05, y: rEyeCenter.y })];
    const rEyeV = [m({ x: rEyeCenter.x, y: rEye[1].y - eyeDist * 0.03 }), m({ x: rEyeCenter.x, y: rEye[4].y + eyeDist * 0.03 })];

    // === EYEBROWS ===
    const lbrowD = ip(lbrow, 24);
    const rbrowD = ip(rbrow, 24);
    const lbrowUpper = ip([lbrow[0], { x: (lbrow[0].x + lbrow[2].x) / 2, y: lbrow[1].y - eyeDist * 0.08 }, lbrow[2], { x: (lbrow[2].x + lbrow[4].x) / 2, y: lbrow[3].y - eyeDist * 0.06 }, lbrow[4]], 20);
    const rbrowUpper = ip([rbrow[0], { x: (rbrow[0].x + rbrow[2].x) / 2, y: rbrow[1].y - eyeDist * 0.08 }, rbrow[2], { x: (rbrow[2].x + rbrow[4].x) / 2, y: rbrow[3].y - eyeDist * 0.06 }, rbrow[4]], 20);

    // === MOUTH (detailed) ===
    const mOuterU = ip([mOuter[0], mOuter[1], mOuter[2], mOuter[3], mOuter[4], mOuter[5], mOuter[6]], 24);
    const mOuterL = ip([mOuter[6], mOuter[7], mOuter[8], mOuter[9], mOuter[10], mOuter[11], mOuter[0]], 24);
    const mInnerU = ip([mInner[0], mInner[1], mInner[2], mInner[3]], 14);
    const mInnerL = ip([mInner[4], mInner[5], mInner[6], mInner[7], mInner[0]], 14);
    const mFull = ip([...mOuter, mOuter[0]], 40);

    // Mouth horizontal lines
    const mouthHLines: { x: number; y: number }[][] = [];
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const li = Math.min(Math.floor(mOuterU.length * t), mOuterU.length - 1);
      const ri = Math.min(Math.floor(mOuterL.length * t), mOuterL.length - 1);
      mouthHLines.push([mOuterU[li], mOuterL[ri]]);
    }

    // === 3D FACE MESH GRID ===
    const meshH = 14, meshV = 12;
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.07)';
    ctx.lineWidth = 0.3;

    for (let i = 1; i < meshH; i++) {
      const t = i / meshH;
      const topPt = foreheadD[Math.min(Math.floor(foreheadD.length * t), foreheadD.length - 1)];
      const botPt = chinD[Math.min(Math.floor(chinD.length * t), chinD.length - 1)];
      if (topPt && botPt) {
        const leftEdge = leftJawD[Math.min(Math.floor(leftJawD.length * t), leftJawD.length - 1)] || lCheekD[Math.min(Math.floor(lCheekD.length * t), lCheekD.length - 1)];
        const rightEdge = rightJawD[Math.min(Math.floor(rightJawD.length * t), rightJawD.length - 1)] || rCheekD[Math.min(Math.floor(rCheekD.length * t), rCheekD.length - 1)];
        if (leftEdge && rightEdge) {
          for (let j = 1; j < meshV; j++) {
            const jt = j / meshV;
            const lx = leftEdge.x + (topPt.x - leftEdge.x) * jt;
            const ly = leftEdge.y + (topPt.y - leftEdge.y) * jt;
            const rx = rightEdge.x + (topPt.x - rightEdge.x) * jt;
            const ry = rightEdge.y + (topPt.y - rightEdge.y) * jt;
            ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(leftEdge.x, leftEdge.y); ctx.lineTo(topPt.x, topPt.y); ctx.lineTo(rightEdge.x, rightEdge.y); ctx.stroke();
        }
      }
    }

    // Vertical mesh lines
    for (let j = 1; j < meshV; j++) {
      const t = j / meshV;
      for (let i = 1; i < meshH; i++) {
        const ht = i / meshH;
        const fI = Math.min(Math.floor(foreheadD.length * ht), foreheadD.length - 1);
        const cI = Math.min(Math.floor(chinD.length * ht), chinD.length - 1);
        const fPt = foreheadD[fI], cPt = chinD[cI];
        if (fPt && cPt) {
          const x = fPt.x + (cPt.x - fPt.x) * t;
          const y = fPt.y + (cPt.y - fPt.y) * t;
          ctx.beginPath(); ctx.arc(x, y, 0.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0, 180, 255, 0.06)'; ctx.fill();
        }
      }
    }

    // === DRAW ALL CONTOUR LINES ===
    const drawLine = (line: { x: number; y: number }[], color: string, w: number) => {
      if (line.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);
      for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
      ctx.stroke();
    };

    // Face outline
    drawLine(jawD, 'rgba(0, 200, 255, 0.35)', 0.7);
    drawLine(chinD, 'rgba(0, 200, 255, 0.3)', 0.6);
    drawLine(leftJawD, 'rgba(0, 200, 255, 0.3)', 0.6);
    drawLine(rightJawD, 'rgba(0, 200, 255, 0.3)', 0.6);
    drawLine(lCheekD, 'rgba(0, 200, 255, 0.25)', 0.5);
    drawLine(rCheekD, 'rgba(0, 200, 255, 0.25)', 0.5);
    drawLine(foreheadD, 'rgba(0, 200, 255, 0.25)', 0.5);
    drawLine(lInnerFace, 'rgba(0, 200, 255, 0.15)', 0.3);
    drawLine(rInnerFace, 'rgba(0, 200, 255, 0.15)', 0.3);

    // Nose
    drawLine(noseBridgeL, 'rgba(0, 255, 150, 0.4)', 0.6);
    drawLine(noseLeftSide, 'rgba(0, 255, 150, 0.35)', 0.5);
    drawLine(noseRightSide, 'rgba(0, 255, 150, 0.35)', 0.5);
    drawLine(noseNostrilL, 'rgba(0, 255, 150, 0.4)', 0.5);
    drawLine(noseNostrilR, 'rgba(0, 255, 150, 0.4)', 0.5);
    drawLine(noseBottomD, 'rgba(0, 255, 150, 0.35)', 0.5);
    drawLine(noseTipArc, 'rgba(0, 255, 200, 0.4)', 0.6);
    for (const hl of noseHLines) drawLine(hl, 'rgba(0, 255, 150, 0.12)', 0.3);

    // Eyes
    drawLine(lEyeFull, 'rgba(255, 80, 80, 0.5)', 0.8);
    drawLine(lEyeUpper, 'rgba(255, 80, 80, 0.3)', 0.4);
    drawLine(lEyeLower, 'rgba(255, 80, 80, 0.3)', 0.4);
    drawLine(rEyeFull, 'rgba(255, 80, 80, 0.5)', 0.8);
    drawLine(rEyeUpper, 'rgba(255, 80, 80, 0.3)', 0.4);
    drawLine(rEyeLower, 'rgba(255, 80, 80, 0.3)', 0.4);

    // Iris + pupil
    drawLine(lIrisD, 'rgba(255, 100, 100, 0.35)', 0.5);
    drawLine(rIrisD, 'rgba(255, 100, 100, 0.35)', 0.5);
    drawLine(lPupilD, 'rgba(255, 120, 120, 0.5)', 0.6);
    drawLine(rPupilD, 'rgba(255, 120, 120, 0.5)', 0.6);

    // Eye crosshair
    drawLine(lEyeH, 'rgba(255, 200, 200, 0.2)', 0.3);
    drawLine(lEyeV, 'rgba(255, 200, 200, 0.2)', 0.3);
    drawLine(rEyeH, 'rgba(255, 200, 200, 0.2)', 0.3);
    drawLine(rEyeV, 'rgba(255, 200, 200, 0.2)', 0.3);

    // Eyebrows
    drawLine(lbrowD, 'rgba(255, 100, 100, 0.35)', 0.5);
    drawLine(rbrowD, 'rgba(255, 100, 100, 0.35)', 0.5);
    drawLine(lbrowUpper, 'rgba(255, 100, 100, 0.2)', 0.3);
    drawLine(rbrowUpper, 'rgba(255, 100, 100, 0.2)', 0.3);

    // Mouth
    drawLine(mOuterU, 'rgba(255, 180, 50, 0.4)', 0.6);
    drawLine(mOuterL, 'rgba(255, 180, 50, 0.4)', 0.6);
    drawLine(mInnerU, 'rgba(255, 140, 30, 0.3)', 0.4);
    drawLine(mInnerL, 'rgba(255, 140, 30, 0.3)', 0.4);
    drawLine(mFull, 'rgba(255, 180, 50, 0.2)', 0.3);
    for (const hl of mouthHLines) drawLine(hl, 'rgba(255, 180, 50, 0.1)', 0.3);

    // === TINY DOTS (high density, depth-colored) ===
    const dot = (p: { x: number; y: number }, r: number, g: string, a: number) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = g.replace('A', String(a));
      ctx.fill();
    };

    // Face outline dots
    for (const p of jawD) dot(p, 0.5, 'rgba(0,220,255,A)', 0.5);
    for (const p of leftJawD) dot(p, 0.4, 'rgba(0,220,255,A)', 0.4);
    for (const p of rightJawD) dot(p, 0.4, 'rgba(0,220,255,A)', 0.4);
    for (const p of chinD) dot(p, 0.4, 'rgba(0,220,255,A)', 0.45);
    for (const p of lCheekD) dot(p, 0.3, 'rgba(0,200,255,A)', 0.35);
    for (const p of rCheekD) dot(p, 0.3, 'rgba(0,200,255,A)', 0.35);
    for (const p of foreheadD) dot(p, 0.3, 'rgba(0,200,255,A)', 0.3);

    // Nose dots
    for (const p of noseBridgeL) dot(p, 0.4, 'rgba(0,255,150,A)', 0.45);
    for (const p of noseLeftSide) dot(p, 0.35, 'rgba(0,255,150,A)', 0.4);
    for (const p of noseRightSide) dot(p, 0.35, 'rgba(0,255,150,A)', 0.4);
    for (const p of noseNostrilL) dot(p, 0.35, 'rgba(0,255,180,A)', 0.45);
    for (const p of noseNostrilR) dot(p, 0.35, 'rgba(0,255,180,A)', 0.45);
    for (const p of noseBottomD) dot(p, 0.3, 'rgba(0,255,150,A)', 0.35);

    // Eye dots
    for (const p of lEyeFull) dot(p, 0.4, 'rgba(255,80,80,A)', 0.55);
    for (const p of rEyeFull) dot(p, 0.4, 'rgba(255,80,80,A)', 0.55);
    for (const p of lIrisD) dot(p, 0.3, 'rgba(255,120,120,A)', 0.45);
    for (const p of rIrisD) dot(p, 0.3, 'rgba(255,120,120,A)', 0.45);
    for (const p of lPupilD) dot(p, 0.25, 'rgba(255,150,150,A)', 0.6);
    for (const p of rPupilD) dot(p, 0.25, 'rgba(255,150,150,A)', 0.6);

    // Eyebrow dots
    for (const p of lbrowD) dot(p, 0.3, 'rgba(255,100,100,A)', 0.4);
    for (const p of rbrowD) dot(p, 0.3, 'rgba(255,100,100,A)', 0.4);
    for (const p of lbrowUpper) dot(p, 0.25, 'rgba(255,100,100,A)', 0.3);
    for (const p of rbrowUpper) dot(p, 0.25, 'rgba(255,100,100,A)', 0.3);

    // Mouth dots
    for (const p of mOuterU) dot(p, 0.35, 'rgba(255,180,50,A)', 0.45);
    for (const p of mOuterL) dot(p, 0.35, 'rgba(255,180,50,A)', 0.45);
    for (const p of mInnerU) dot(p, 0.25, 'rgba(255,140,30,A)', 0.35);
    for (const p of mInnerL) dot(p, 0.25, 'rgba(255,140,30,A)', 0.35);

    // === 68 LANDMARK DOTS (primary, slightly bigger) ===
    const mapped = pts.map(m);
    const depths = pts.map(depth);
    const glowA = phase === 'countdown' ? 0.8 : 0.4;
    for (let i = 0; i < mapped.length; i++) {
      const p = mapped[i], d = depths[i];
      const sz = 0.8 + d * 1.2;
      let c: string;
      if (i >= 36 && i <= 47) c = `rgba(255,80,80,${0.5 + d * 0.5})`;
      else if (i >= 27 && i <= 35) c = `rgba(0,255,150,${0.5 + d * 0.5})`;
      else if (i >= 48 && i <= 67) c = `rgba(255,180,50,${0.5 + d * 0.5})`;
      else if (i <= 16) c = `rgba(0,220,255,${0.5 + d * 0.5})`;
      else c = `rgba(180,200,255,${0.4 + d * 0.4})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = c; ctx.fill();
      if (d > 0.65) {
        ctx.beginPath(); ctx.arc(p.x, p.y, sz + 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,200,${glowA * 0.15 * d})`; ctx.fill();
      }
    }

    // === GLOBAL CROSSHAIR ===
    const eyeMid = m(nc);
    const noseP = m(noseTip);
    const chinP = m(pts[8]);
    ctx.strokeStyle = 'rgba(255,255,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(eyeMid.x - eyeDist * sx * 0.6, eyeMid.y); ctx.lineTo(eyeMid.x + eyeDist * sx * 0.6, eyeMid.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(eyeMid.x, eyeMid.y - eyeDist * sy * 0.4); ctx.lineTo(chinP.x, chinP.y + eyeDist * sy * 0.1); ctx.stroke();
    ctx.setLineDash([]);

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
