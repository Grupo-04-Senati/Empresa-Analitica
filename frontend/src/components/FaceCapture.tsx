import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader2, Shield, Eye, Scan } from 'lucide-react';
import {
  loadFaceModels, detectFace, analyzeFaceQuality, checkAngle,
} from '../services/faceRecognition';
import { faceApiRegister, faceApiLogin, faceApiCheckRegistered } from '../services/faceApi';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  usuarioId?: number;
  onCapture?: (photos: Record<string, string>) => void;
  onLoginMatch?: (userId: number, nombre: string) => void;
  onClose: () => void;
}

const ANGLES = [
  { key: 'frontal', label: 'Frontal', instruction: 'Mira de frente' },
  { key: 'izquierda', label: 'Izquierda', instruction: 'Gira a la IZQUIERDA' },
  { key: 'derecha', label: 'Derecha', instruction: 'Gira a la DERECHA' },
];

export const FaceCapture: React.FC<FaceCaptureProps> = ({ mode, usuarioId, onCapture, onLoginMatch, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'loading' | 'scanning' | 'countdown' | 'processing' | 'done' | 'error'>('loading');
  const [currentAngle, setCurrentAngle] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('Buscando rostro...');
  const [multiFace, setMultiFace] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const goodFramesRef = useRef(0);
  const photosRef = useRef<Record<string, string>>({});
  const angleRef = useRef(0);
  const phaseRef = useRef('loading');

  photosRef.current = capturedPhotos;
  angleRef.current = currentAngle;
  phaseRef.current = phase;

  const stopAll = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); }
    if (intervalRef.current) { clearInterval(intervalRef.current); }
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
        setStatusMsg('Coloque su rostro frente a la camara');
      } catch (err: any) {
        if (!alive) return;
        setErrorMsg(err?.name === 'NotAllowedError' ? 'Permiso de camara denegado.' : 'No se pudo acceder a la camara.');
        setPhase('error');
      }
    })();
    return () => { alive = false; stopAll(); };
  }, [stopAll]);

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
        const det = await detectFace(video);

        if (!det.detected) {
          if (det.count > 1) {
            setMultiFace(true);
            setStatusMsg('Solo una persona en pantalla');
          } else {
            setMultiFace(false);
            setStatusMsg('Coloque su rostro frente a la camara');
          }
          setQuality(null);
          goodFramesRef.current = 0;
          return;
        }

        setMultiFace(false);

        const angle = ANGLES[angleRef.current]?.key as 'frontal' | 'izquierda' | 'derecha';
        const q = await analyzeFaceQuality(video, angle);
        if (!alive) return;
        setQuality(q);

        if (phaseRef.current === 'scanning') {
          if (q.score >= 0.6 && q.detected && q.centered && q.angleOk) {
            goodFramesRef.current++;
            setStatusMsg(q.message || 'Detectando...');
            if (goodFramesRef.current >= 3) {
              goodFramesRef.current = 0;
              setStatusMsg('Posicion correcta - Capturando...');
              alive = false;
              if (intervalRef.current) clearInterval(intervalRef.current);
              setTimeout(() => startCapture(), 300);
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
  }, [phase]);

  const startCapture = useCallback(() => {
    setPhase('countdown');
    let c = 3;
    setCountdown(c);
    const angle = ANGLES[angleRef.current]?.key as 'frontal' | 'izquierda' | 'derecha';
    let angleFailed = false;

    const tick = async () => {
      c--;
      if (c <= 0) {
        if (angleFailed) {
          setStatusMsg('Angulo incorrecto - intenta de nuevo');
          setCountdown(0);
          timerRef.current = setTimeout(() => {
            setPhase('scanning');
            goodFramesRef.current = 0;
          }, 1500);
          return;
        }

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
          } else if (mode === 'register') {
            setPhase('processing');
            doRegister(newPhotos);
          } else {
            doLogin(newPhotos);
          }
        }, 1000);
        return;
      }

      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        const angleCheck = await checkAngle(video, angle);
        angleFailed = !angleCheck.ok;
        setStatusMsg(angleCheck.ok ? 'Manteniendo posicion...' : 'Ajuste el angulo');
      }

      setCountdown(c);
      timerRef.current = setTimeout(tick, 700);
    };
    timerRef.current = setTimeout(tick, 700);
  }, [mode, onCapture]);

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

          {phase === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={28} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium">{successMsg || 'Completado!'}</p>
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 mt-2">Cerrar</button>
            </div>
          )}

          {(phase === 'scanning' || phase === 'countdown') && (
            <>
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />

                <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
                  <svg viewBox="0 0 200 260" className={`w-40 h-52 transition-colors duration-300 ${
                    quality?.detected && quality?.centered ? 'text-green-400' :
                    quality?.detected ? 'text-yellow-400' : 'text-white/60'
                  }`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <ellipse cx="100" cy="110" rx="65" ry="80" strokeDasharray="8 4" />
                    <path d="M60 95 Q65 80 75 78" strokeWidth="2" />
                    <path d="M140 95 Q135 80 125 78" strokeWidth="2" />
                    <circle cx="78" cy="98" r="3" fill="currentColor" stroke="none" />
                    <circle cx="122" cy="98" r="3" fill="currentColor" stroke="none" />
                    <path d="M92 120 Q100 128 108 120" strokeWidth="2" />
                    <line x1="100" y1="112" x2="100" y2="122" strokeWidth="2" />
                    <path d="M85 145 Q100 158 115 145" strokeWidth="2" />
                    <path d="M35 85 Q30 110 35 140" strokeWidth="2" strokeDasharray="6 4" />
                    <path d="M165 85 Q170 110 165 140" strokeWidth="2" strokeDasharray="6 4" />
                  </svg>
                </div>

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
                      <div className={`w-2 h-2 rounded-full ${quality?.centered ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <span className="text-white text-xs">{quality?.centered ? 'Centrado' : 'Centra tu cara'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${quality?.angleOk ? 'bg-green-400' : 'bg-blue-400'}`} />
                      <span className="text-white text-xs">{quality?.angleOk ? 'Angulo OK' : 'Ajusta angulo'}</span>
                    </div>
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
                      {currentAngle === 0 && 'Posiciona tu cara dentro del ovalo de frente'}
                      {currentAngle === 1 && 'Gira tu cara lentamente a la IZQUIERDA'}
                      {currentAngle === 2 && 'Gira tu cara lentamente a la DERECHA'}
                    </p>
                  </div>
                </div>
              </div>

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
                <div className="flex items-center gap-1"><Eye size={12} /><span>Deteccion facial</span></div>
                <div className="flex items-center gap-1"><Scan size={12} /><span>3 angulos</span></div>
              </div>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
