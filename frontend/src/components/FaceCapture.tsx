import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader2, Shield, Eye, Scan } from 'lucide-react';
import * as faceapi from 'face-api.js';
import {
  loadFaceModels, detectFace, analyzeFaceQuality, checkAngle,
} from '../services/faceRecognition';
import { faceApiRegister, faceApiLogin } from '../services/faceApi';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  usuarioId?: number;
  onCapture?: (photos: Record<string, string>) => void;
  onLoginMatch?: (userId: number, nombre: string) => void;
  onClose: () => void;
}

const ANGLES = [
  { key: 'frontal', label: 'Frontal', instruction: 'Mira de frente a la camara' },
  { key: 'izquierda', label: 'Izquierda', instruction: 'Gira la cabeza lentamente' },
  { key: 'derecha', label: 'Derecha', instruction: 'Gira la cabeza al otro lado' },
];

type Phase = 'loading' | 'scanning' | 'countdown' | 'processing' | 'done' | 'error';

interface LandmarkData {
  leftEye: { x: number; y: number }[];
  rightEye: { x: number; y: number }[];
  nose: { x: number; y: number }[];
  mouth: { x: number; y: number }[];
  jaw: { x: number; y: number }[];
}

interface FaceGeometry {
  interEyeDist: number;
  noseLength: number;
  mouthWidth: number;
  jawWidth: number;
  faceWidth: number;
  faceHeight: number;
  eyeAngle: number;
  noseOffsetNorm: number;
  pitchAngle: number;
  yawAngle: number;
  probability: number;
  distance: string;
  landmarks: LandmarkData;
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
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goodFramesRef = useRef(0);
  const photosRef = useRef<Record<string, string>>({});
  const angleRef = useRef(0);
  const phaseRef = useRef<Phase>('loading');
  const startCaptureRef = useRef<() => void>(() => {});
  const doLoginRef = useRef<(photos: Record<string, string>) => void>(() => {});

  photosRef.current = capturedPhotos;
  angleRef.current = currentAngle;
  phaseRef.current = phase;

  const stopAll = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); }
    if (intervalRef.current) { clearInterval(intervalRef.current); }
  }, []);

  const drawLandmarks = useCallback((landmarks: faceapi.FaceLandmarks68, videoW: number, videoH: number, canvasW: number, canvasH: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    const scaleX = canvasW / videoW;
    const scaleY = canvasH / videoH;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvasW, 0);

    const pts = landmarks.positions;

    const getPoint = (idx: number) => ({
      x: pts[idx].x * scaleX,
      y: pts[idx].y * scaleY,
    });

    const drawPoint = (p: { x: number; y: number }, color: string, size: number = 3) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawLine = (a: { x: number; y: number }, b: { x: number; y: number }, color: string) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const drawContour = (indices: number[], color: string) => {
      if (indices.length < 2) return;
      ctx.beginPath();
      const first = getPoint(indices[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < indices.length; i++) {
        const p = getPoint(indices[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const jawIndices = Array.from({ length: 17 }, (_, i) => i);
    const leftEyebrowIndices = [17, 18, 19, 20, 21];
    const rightEyebrowIndices = [22, 23, 24, 25, 26];
    const noseIndices = [27, 28, 29, 30, 31, 32, 33, 34, 35];
    const leftEyeIndices = [36, 37, 38, 39, 40, 41, 36];
    const rightEyeIndices = [42, 43, 44, 45, 46, 47, 42];
    const mouthOuterIndices = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48];
    const mouthInnerIndices = [60, 61, 62, 63, 64, 65, 66, 67, 60];

    drawContour(jawIndices, 'rgba(0, 200, 255, 0.6)');
    drawContour(leftEyebrowIndices, 'rgba(255, 200, 0, 0.6)');
    drawContour(rightEyebrowIndices, 'rgba(255, 200, 0, 0.6)');
    drawContour(noseIndices, 'rgba(0, 255, 100, 0.6)');
    drawContour(leftEyeIndices, 'rgba(255, 100, 100, 0.8)');
    drawContour(rightEyeIndices, 'rgba(255, 100, 100, 0.8)');
    drawContour(mouthOuterIndices, 'rgba(255, 150, 0, 0.6)');
    drawContour(mouthInnerIndices, 'rgba(255, 100, 200, 0.5)');

    for (let i = 0; i < pts.length; i++) {
      const p = getPoint(i);
      let color = 'rgba(255,255,255,0.7)';
      let size = 2;
      if (i >= 36 && i <= 41) { color = '#ff4444'; size = 3; }
      else if (i >= 42 && i <= 47) { color = '#ff4444'; size = 3; }
      else if (i >= 27 && i <= 35) { color = '#44ff44'; size = 3; }
      else if (i >= 48 && i <= 67) { color = '#ff8800'; size = 2; }
      else if (i <= 16) { color = '#00ccff'; size = 2; }
      drawPoint(p, color, size);
    }

    const leftEyeCenter = {
      x: pts.slice(36, 42).reduce((s, p) => s + p.x, 0) / 6 * scaleX,
      y: pts.slice(36, 42).reduce((s, p) => s + p.y, 0) / 6 * scaleY,
    };
    const rightEyeCenter = {
      x: pts.slice(42, 48).reduce((s, p) => s + p.x, 0) / 6 * scaleX,
      y: pts.slice(42, 48).reduce((s, p) => s + p.y, 0) / 6 * scaleY,
    };
    const noseTip = getPoint(30);
    const mouthCenter = {
      x: pts.slice(48, 68).reduce((s, p) => s + p.x, 0) / 20 * scaleX,
      y: pts.slice(48, 68).reduce((s, p) => s + p.y, 0) / 20 * scaleY,
    };
    const chin = getPoint(8);

    drawLine(leftEyeCenter, rightEyeCenter, 'rgba(255,255,0,0.3)');
    drawLine(noseTip, mouthCenter, 'rgba(0,255,0,0.3)');
    drawLine(leftEyeCenter, chin, 'rgba(0,200,255,0.2)');
    drawLine(rightEyeCenter, chin, 'rgba(0,200,255,0.2)');

    ctx.restore();
  }, []);

  const calculateGeometry = useCallback((landmarks: faceapi.FaceLandmarks68, videoW: number, videoH: number): FaceGeometry => {
    const pts = landmarks.positions;

    const leftEye = pts[36];
    const rightEye = pts[45];
    const noseTip = pts[30];
    const noseBridge = pts[27];
    const chin = pts[8];
    const leftMouth = pts[48];
    const rightMouth = pts[54];
    const leftJaw = pts[0];
    const rightJaw = pts[16];

    const interEyeDist = Math.sqrt((rightEye.x - leftEye.x) ** 2 + (rightEye.y - leftEye.y) ** 2);
    const noseLength = Math.sqrt((noseTip.x - noseBridge.x) ** 2 + (noseTip.y - noseBridge.y) ** 2);
    const mouthWidth = Math.sqrt((rightMouth.x - leftMouth.x) ** 2 + (rightMouth.y - leftMouth.y) ** 2);
    const jawWidth = Math.sqrt((rightJaw.x - leftJaw.x) ** 2 + (rightJaw.y - leftJaw.y) ** 2);
    const faceWidth = jawWidth;
    const faceHeight = Math.sqrt((chin.x - noseBridge.x) ** 2 + (chin.y - noseBridge.y) ** 2);

    const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    const centerX = (leftEye.x + rightEye.x) / 2;
    const noseOffsetNorm = (noseTip.x - centerX) / (interEyeDist || 1);

    const eyeToNoseDist = Math.sqrt((noseTip.x - centerX) ** 2 + (noseTip.y - (leftEye.y + rightEye.y) / 2) ** 2);
    const pitchAngle = (eyeToNoseDist / (interEyeDist || 1)) * 30;

    const yawAngle = noseOffsetNorm * 45;

    const faceArea = faceWidth * faceHeight;
    const imageArea = videoW * videoH;
    const faceRatio = faceArea / imageArea;

    let distance = 'optimo';
    if (faceRatio < 0.03) distance = 'muy_lejos';
    else if (faceRatio < 0.06) distance = 'lejos';
    else if (faceRatio > 0.15) distance = 'muy_cerca';
    else if (faceRatio > 0.10) distance = 'cerca';

    const symScore = 1 - Math.abs(noseOffsetNorm);
    const sizeScore = Math.min(1, faceRatio / 0.08);
    const angleScore = 1 - Math.abs(yawAngle) / 45;
    const probability = (symScore * 0.3 + sizeScore * 0.3 + angleScore * 0.4);

    const leftEyePoints = pts.slice(36, 42).map(p => ({ x: p.x, y: p.y }));
    const rightEyePoints = pts.slice(42, 48).map(p => ({ x: p.x, y: p.y }));
    const nosePoints = pts.slice(27, 36).map(p => ({ x: p.x, y: p.y }));
    const mouthPoints = pts.slice(48, 68).map(p => ({ x: p.x, y: p.y }));
    const jawPoints = pts.slice(0, 17).map(p => ({ x: p.x, y: p.y }));

    return {
      interEyeDist: Math.round(interEyeDist),
      noseLength: Math.round(noseLength),
      mouthWidth: Math.round(mouthWidth),
      jawWidth: Math.round(jawWidth),
      faceWidth: Math.round(faceWidth),
      faceHeight: Math.round(faceHeight),
      eyeAngle: Math.round(eyeAngle * 10) / 10,
      noseOffsetNorm: Math.round(noseOffsetNorm * 1000) / 1000,
      pitchAngle: Math.round(pitchAngle * 10) / 10,
      yawAngle: Math.round(yawAngle * 10) / 10,
      probability: Math.round(probability * 1000) / 1000,
      distance,
      landmarks: {
        leftEye: leftEyePoints,
        rightEye: rightEyePoints,
        nose: nosePoints,
        mouth: mouthPoints,
        jaw: jawPoints,
      },
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadFaceModels();
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setPhase('scanning');
        setStatusMsg(`Posicion: ${ANGLES[0].instruction}`);
      } catch (err: any) {
        if (!alive) return;
        setErrorMsg(err?.name === 'NotAllowedError' ? 'Permiso de camara denegado.' : 'No se pudo acceder a la camara.');
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

    let alive = true;
    intervalRef.current = setInterval(async () => {
      if (!alive || !video || video.readyState < 2) return;

      try {
        const inputSize = 416;
        const detections = await (faceapi as any)
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.3 }))
          .withFaceLandmarks();

        if (!detections) {
          setMultiFace(false);
          setStatusMsg('Coloque su rostro frente a la camara');
          setQuality(null);
          setFaceGeometry(null);
          goodFramesRef.current = 0;

          const overlay = overlayRef.current;
          if (overlay) {
            const ctx = overlay.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
          }
          return;
        }

        const det = { detected: true, count: 1, landmarks: detections.landmarks, score: detections.detection.score };
        setMultiFace(false);

        const angle = ANGLES[angleRef.current]?.key as 'frontal' | 'izquierda' | 'derecha';
        const q = await analyzeFaceQuality(video, angle);
        if (!alive) return;
        setQuality(q);

        const videoW = video.videoWidth || video.clientWidth;
        const videoH = video.videoHeight || video.clientHeight;
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.width = overlay.clientWidth;
          overlay.height = overlay.clientHeight;
          drawLandmarks(det.landmarks, videoW, videoH, overlay.width, overlay.height);
        }

        const geom = calculateGeometry(det.landmarks, videoW, videoH);
        setFaceGeometry(geom);

        if (phaseRef.current === 'scanning') {
          const isGood = q.detected && q.angleOk && q.score >= 0.3;

          if (isGood) {
            goodFramesRef.current++;
            setStatusMsg(q.message || 'Detectando...');
            if (goodFramesRef.current >= 2) {
              goodFramesRef.current = 0;
              setStatusMsg('Posicion correcta - Capturando...');
              alive = false;
              if (intervalRef.current) clearInterval(intervalRef.current);
              setTimeout(() => startCaptureRef.current(), 300);
              return;
            }
          } else {
            goodFramesRef.current = Math.max(0, goodFramesRef.current - 1);
            setStatusMsg(q.message || 'Ajuste su posicion');
          }
        }
      } catch {}
    }, 300);

    return () => { alive = false; if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, drawLandmarks, calculateGeometry]);

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
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const photo = canvas.toDataURL('image/jpeg', 0.95);

        const angleIdx = angleRef.current;
        const ang = ANGLES[angleIdx];
        const newPhotos = { ...photosRef.current, [ang.key]: photo };
        photosRef.current = newPhotos;
        setCapturedPhotos(newPhotos);
        setStatusMsg(`${ang.label} capturada!`);
        setCountdown(0);

        timerRef.current = setTimeout(() => {
          if (angleIdx < ANGLES.length - 1) {
            setCurrentAngle(angleIdx + 1);
            goodFramesRef.current = 0;
            setPhase('scanning');
            setStatusMsg(`Posicion: ${ANGLES[angleIdx + 1].instruction}`);
          } else if (mode === 'login') {
            doLoginRef.current(newPhotos);
          } else if (mode === 'register' && usuarioId) {
            setPhase('processing');
            doRegister(newPhotos);
          } else {
            setPhase('done');
            setSuccessMsg('Fotos capturadas correctamente');
            stopAll();
            if (onCapture) onCapture(newPhotos);
          }
        }, 1000);
        return;
      }

      setCountdown(c);
      timerRef.current = setTimeout(tick, 700);
    };
    timerRef.current = setTimeout(tick, 700);
  }, [mode, onCapture, usuarioId, stopAll]);

  startCaptureRef.current = startCapture;

  const doRegister = useCallback(async (photos: Record<string, string>) => {
    setPhase('processing');
    try {
      setStatusMsg('Enviando al servidor de reconocimiento facial...');
      const result = await faceApiRegister(usuarioId!, photos);
      if (!result.ok) {
        setErrorMsg(result.error || 'Error registrando rostro');
        setPhase('error');
        return;
      }
      setSuccessMsg('Rostro registrado correctamente');
      setPhase('done');
      stopAll();
      if (onCapture) onCapture(photos);
    } catch {
      setErrorMsg('Error de conexion con el servidor');
      setPhase('error');
    }
  }, [usuarioId, onCapture, stopAll]);

  const doLogin = useCallback(async (photos: Record<string, string>) => {
    setPhase('processing');
    try {
      setStatusMsg('Verificando identidad en el servidor...');
      const result = await faceApiLogin(photos);
      if (!result.ok) {
        setErrorMsg(result.error || 'Rostro no reconocido');
        setPhase('error');
        return;
      }
      setSuccessMsg(`Bienvenido ${result.nombre}`);
      setPhase('done');
      stopAll();
      if (onLoginMatch) onLoginMatch(result.usuario_id!, result.nombre!);
    } catch {
      setErrorMsg('Error de conexion con el servidor');
      setPhase('error');
    }
  }, [onLoginMatch, stopAll]);

  doLoginRef.current = doLogin;

  const handleClose = () => { stopAll(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              {mode === 'register' ? 'Registro Facial Seguro' : 'Verificacion de Identidad'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100"><X size={18} className="text-slate-500" /></button>
        </div>

        <div className="p-5">
          {phase === 'loading' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Cargando modelos de seguridad...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <AlertCircle size={28} className="text-red-500" />
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700">Cerrar</button>
            </div>
          )}

          {phase === 'processing' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">{statusMsg || (mode === 'register' ? 'Registrando tu rostro...' : 'Verificando identidad...')}</p>
            </div>
          )}

          {(phase === 'scanning' || phase === 'countdown') && (
            <>
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none z-5" />

                {phase === 'countdown' && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                    <span className="text-8xl font-bold text-white drop-shadow-lg animate-pulse">{countdown}</span>
                  </div>
                )}

                <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                  <div className="bg-black/60 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${quality?.detected ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-white text-xs">{quality?.detected ? 'Rostro detectado' : 'Buscando rostro...'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        currentAngle === 0 ? (quality?.centered ? 'bg-green-400' : 'bg-yellow-400') : 'bg-green-400'
                      }`} />
                      <span className="text-white text-xs">
                        {currentAngle === 0
                          ? (quality?.centered ? 'Centrado' : 'Centra tu cara')
                          : (quality?.detected ? 'Rostro OK' : 'Gira la cabeza')
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${quality?.angleOk ? 'bg-green-400' : 'bg-blue-400'}`} />
                      <span className="text-white text-xs">{quality?.angleOk ? 'Angulo OK' : 'Ajusta angulo'}</span>
                    </div>
                    {quality?.detected && (
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${quality.probability > 0.7 ? 'bg-green-400' : quality.probability > 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                        <span className="text-white text-xs">Prob: {(quality.probability * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-black/60 rounded-lg px-2 py-1">
                    <span className="text-white text-xs font-bold">{currentAngle + 1}/3</span>
                  </div>
                </div>

                {multiFace && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/30 z-20">
                    <div className="bg-red-500 rounded-2xl px-6 py-3 flex items-center gap-2">
                      <AlertCircle size={24} className="text-white" />
                      <span className="text-white text-lg font-bold">Solo una persona en pantalla</span>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10">
                  <div className="bg-black/60 rounded-xl px-5 py-3 text-center max-w-xs">
                    <p className="text-white text-base font-bold">{statusMsg}</p>
                    <p className="text-white/70 text-xs mt-1">
                      {currentAngle === 0 && 'Posiciona tu cara dentro del ovalo, mirando de frente'}
                      {currentAngle === 1 && 'Gira la cabeza lentamente a un lado'}
                      {currentAngle === 2 && 'Gira la cabeza lentamente al otro lado'}
                    </p>
                  </div>
                </div>
              </div>

              {faceGeometry && (
                <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] text-slate-500">
                  <div className="bg-slate-50 rounded px-2 py-1 text-center">
                    <div className="font-bold text-slate-700">Ojos</div>
                    <div>{faceGeometry.interEyeDist}px</div>
                  </div>
                  <div className="bg-slate-50 rounded px-2 py-1 text-center">
                    <div className="font-bold text-slate-700">Nariz</div>
                    <div>{faceGeometry.noseLength}px</div>
                  </div>
                  <div className="bg-slate-50 rounded px-2 py-1 text-center">
                    <div className="font-bold text-slate-700">Boca</div>
                    <div>{faceGeometry.mouthWidth}px</div>
                  </div>
                  <div className="bg-slate-50 rounded px-2 py-1 text-center">
                    <div className="font-bold text-slate-700">Dist</div>
                    <div>{faceGeometry.distance}</div>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      phase === 'countdown' ? 'bg-green-500' :
                      (quality?.score || 0) >= 0.6 ? 'bg-blue-500' : 'bg-yellow-500'
                    }`}
                    style={{
                      width: phase === 'countdown' ? '100%' :
                        `${Math.min(80, (quality?.score || 0) * 100)}%`
                    }}
                  />
                </div>
                <span className="text-xs text-slate-500 font-mono w-16 text-right">
                  {phase === 'countdown' ? 'Capturando' : `${Math.round((quality?.score || 0) * 100)}%`}
                </span>
              </div>

              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-400">
                <div className="flex items-center gap-1"><Eye size={12} /><span>68 puntos</span></div>
                <div className="flex items-center gap-1"><Scan size={12} /><span>3 angulos</span></div>
              </div>
            </>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={28} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium">{successMsg || 'Completado!'}</p>
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 mt-2">Cerrar</button>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
