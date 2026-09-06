import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader2, User, Scan, RefreshCw } from 'lucide-react';
import { loadFaceModels, areModelsLoaded, captureEmbedding, averageEmbeddings, saveFaceEmbedding, matchFaceMultiCapture, detectFaceQuick } from '../services/faceRecognition';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  userId?: number;
  onCapture?: (embedding: Float32Array) => void;
  onLoginMatch?: (userId: number) => void;
  onClose: () => void;
}

type Step = 'loading' | 'camera' | 'capturing' | 'processing' | 'done' | 'error';

export const FaceCapture: React.FC<FaceCaptureProps> = ({ mode, userId, onCapture, onLoginMatch, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectionLoopRef = useRef<number | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [countdown, setCountdown] = useState(0);
  const [captureStep, setCaptureStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadMsg, setLoadMsg] = useState('Iniciando camara...');
  const streamRef = useRef<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceScore, setFaceScore] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
  }, []);

  const drawOverlay = useCallback((box: { x: number; y: number; width: number; height: number } | null, detected: boolean, score: number) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (box) {
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;

      ctx.strokeStyle = detected ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);

      const r = 12;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.stroke();

      const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h));
      glow.addColorStop(0, detected ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fill();
    }
  }, []);

  const runDetectionLoop = useCallback(() => {
    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || !cameraReady) {
        detectionLoopRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result = await detectFaceQuick(video);
        setFaceDetected(result.detected);
        setFaceScore(result.score);
        drawOverlay(result.box, result.detected, result.score);
      } catch {
        setFaceDetected(false);
        setFaceScore(0);
      }

      detectionLoopRef.current = requestAnimationFrame(detect);
    };

    detectionLoopRef.current = requestAnimationFrame(detect);
  }, [cameraReady, drawOverlay]);

  useEffect(() => {
    if (cameraReady && (step === 'camera' || step === 'capturing')) {
      runDetectionLoop();
    }
    return () => {
      if (detectionLoopRef.current) {
        cancelAnimationFrame(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  }, [cameraReady, step, runDetectionLoop]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!areModelsLoaded()) {
        setLoadMsg('Descargando modelos de IA (~6MB, primera vez)...');
      } else {
        setLoadMsg('Modelos listos, abriendo camara...');
      }

      const modelsPromise = loadFaceModels();

      try {
        setLoadMsg('Accediendo a la camara...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        await modelsPromise;
        if (cancelled) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled && videoRef.current) {
              videoRef.current.play().then(() => {
                if (!cancelled) {
                  setCameraReady(true);
                  setStep('camera');
                }
              }).catch((err) => {
                if (!cancelled) {
                  setErrorMsg('Error al iniciar camara: ' + err.message);
                  setStep('error');
                }
              });
            }
          };
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setErrorMsg('Permiso de camara denegado. Habilita el acceso en tu navegador.');
        } else if (err instanceof DOMException && err.name === 'NotFoundError') {
          setErrorMsg('No se encontro camara en tu dispositivo.');
        } else {
          setErrorMsg('Error al iniciar: ' + (err as Error).message);
        }
        setStep('error');
      }
    };

    init();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const doCountdownCapture = useCallback(async () => {
    setStep('capturing');
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < 3; i++) {
      setCaptureStep(i + 1);
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!videoRef.current) return;
      const emb = await captureEmbedding(videoRef.current);
      if (emb) {
        embeddings.push(emb);
      } else {
        setErrorMsg(`Captura ${i + 1}: rostro no detectado. Mira a la camara.`);
        setStep('error');
        return;
      }
    }

    setStep('processing');
    const avg = averageEmbeddings(embeddings);

    if (mode === 'register' && userId) {
      const result = await saveFaceEmbedding(userId, avg);
      if (!result.success) {
        setErrorMsg(result.error || 'Error al guardar el rostro.');
        setStep('error');
        return;
      }
    }

    setStep('done');
    if (onCapture) onCapture(avg);
    stopCamera();
  }, [mode, userId, onCapture, stopCamera]);

  const doLoginScan = useCallback(async () => {
    setStep('processing');
    if (!videoRef.current) return;

    const match = await matchFaceMultiCapture(videoRef.current);
    setStep('done');
    stopCamera();

    if (match && onLoginMatch) {
      onLoginMatch(match.userId);
    } else if (!match) {
      setErrorMsg('Rostro no reconocido. Asegurate de estar bien iluminado y mirando a la camara.');
      setStep('error');
    }
  }, [onLoginMatch, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleRetry = () => {
    setErrorMsg('');
    setFaceDetected(false);
    setFaceScore(0);
    setCameraReady(false);
    setStep('loading');
    stopCamera();

    setTimeout(() => {
      const init = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setCameraReady(true);
                setStep('camera');
              });
            };
          }
        } catch (err) {
          setErrorMsg('Error al reiniciar camara.');
          setStep('error');
        }
      };
      init();
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              {mode === 'register' ? 'Captura Facial' : 'Reconocimiento Facial'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {step === 'loading' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">{loadMsg}</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
              <div className="flex gap-2">
                <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50">
                  Cerrar
                </button>
                <button onClick={handleRetry} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                  <RefreshCw size={14} />
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm text-emerald-700 font-medium">
                {mode === 'register' ? 'Rostro registrado exitosamente' : 'Rostro reconocido'}
              </p>
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                Cerrar
              </button>
            </div>
          )}

          {(step === 'camera' || step === 'capturing' || step === 'processing') && (
            <>
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ transform: 'scaleX(-1)' }}
                />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className={`w-40 h-48 rounded-[50%] border-[3px] transition-colors duration-300 ${
                      step === 'capturing'
                        ? 'border-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                        : faceDetected
                          ? 'border-emerald-400/70'
                          : 'border-white/40'
                    }`}
                  />
                </div>

                {step === 'camera' && (
                  <div className="absolute top-3 left-3 right-3">
                    <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
                      <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                      <span className="text-xs text-white font-medium">
                        {faceDetected
                          ? `Rostro detectado (${Math.round(faceScore * 100)}%)`
                          : 'Coloca tu rostro en el ovalo'}
                      </span>
                    </div>
                  </div>
                )}

                {step === 'camera' && (
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-white/70">Confianza</span>
                        <span className="text-[10px] text-white font-medium">{Math.round(faceScore * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            faceScore > 0.7 ? 'bg-emerald-400' : faceScore > 0.4 ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${Math.min(faceScore * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 'capturing' && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl font-bold text-white drop-shadow-lg animate-pulse">
                      {countdown}
                    </span>
                  </div>
                )}

                {step === 'capturing' && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        className={`w-10 h-2 rounded-full transition-all duration-300 ${
                          s < captureStep ? 'bg-emerald-400' : s === captureStep ? 'bg-white animate-pulse' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {step === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="animate-spin text-white" />
                      <span className="text-sm text-white font-medium">Procesando...</span>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 text-center mt-3">
                {step === 'camera' && mode === 'register' && 'Mira a la camara. Se tomaran 3 fotos automaticamente.'}
                {step === 'camera' && mode === 'login' && 'Mira a la camara para identificarte.'}
                {step === 'capturing' && `Captura ${captureStep} de 3 - Mantente quieto`}
                {step === 'processing' && 'Procesando tu rostro...'}
              </p>

              <div className="flex justify-center mt-4">
                {step === 'camera' && mode === 'register' && (
                  <button
                    onClick={doCountdownCapture}
                    disabled={!faceDetected}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                  >
                    <Camera size={16} />
                    Capturar Rostro
                  </button>
                )}
                {step === 'camera' && mode === 'login' && (
                  <button
                    onClick={doLoginScan}
                    disabled={!faceDetected}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                  >
                    <Scan size={16} />
                    Identificarme
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
