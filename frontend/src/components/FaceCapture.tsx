import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader2, Scan } from 'lucide-react';
import { loadFaceModels, areModelsLoaded, captureEmbedding, averageEmbeddings, saveFaceEmbedding, matchFaceMultiCapture } from '../services/faceRecognition';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  userId?: number;
  onCapture?: (embedding: Float32Array) => void;
  onLoginMatch?: (userId: number) => void;
  onClose: () => void;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ mode, userId, onCapture, onLoginMatch, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<'loading' | 'camera' | 'capturing' | 'processing' | 'done' | 'error'>('loading');
  const [countdown, setCountdown] = useState(0);
  const [captureStep, setCaptureStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const start = async () => {
      try {
        // 1. Get camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // 2. Load models
        await loadFaceModels();
        if (!alive) return;

        // 3. Attach to video
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setStep('camera');
        }
      } catch (err: any) {
        if (!alive) return;
        if (err?.name === 'NotAllowedError') setErrorMsg('Permiso de camara denegado.');
        else if (err?.name === 'NotFoundError') setErrorMsg('No se encontro camara.');
        else setErrorMsg('Error: ' + (err?.message || 'desconocido'));
        setStep('error');
      }
    };

    start();
    return () => { alive = false; stopCamera(); };
  }, [stopCamera]);

  const doRegister = useCallback(async () => {
    setStep('capturing');
    const embeddings: Float32Array[] = [];

    for (let i = 0; i < 3; i++) {
      setCaptureStep(i + 1);
      for (let c = 3; c >= 1; c--) {
        setCountdown(c);
        await new Promise(r => setTimeout(r, 1000));
      }
      const emb = await captureEmbedding(videoRef.current!);
      if (emb) {
        embeddings.push(emb);
      } else {
        setErrorMsg(`Captura ${i + 1}: rostro no detectado.`);
        setStep('error');
        return;
      }
    }

    setStep('processing');
    const avg = averageEmbeddings(embeddings);

    if (userId) {
      const res = await saveFaceEmbedding(userId, avg);
      if (!res.success) {
        setErrorMsg(res.error || 'Error al guardar.');
        setStep('error');
        return;
      }
    }

    setStep('done');
    stopCamera();
    if (onCapture) onCapture(avg);
  }, [userId, onCapture, stopCamera]);

  const doLogin = useCallback(async () => {
    setStep('processing');
    const match = await matchFaceMultiCapture(videoRef.current!);
    stopCamera();

    if (match && onLoginMatch) {
      setStep('done');
      onLoginMatch(match.userId);
    } else {
      setErrorMsg('Rostro no reconocido.');
      setStep('error');
    }
  }, [onLoginMatch, stopCamera]);

  const close = () => { stopCamera(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              {mode === 'register' ? 'Captura Facial' : 'Reconocimiento Facial'}
            </h3>
          </div>
          <button onClick={close} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {/* LOADING */}
          {step === 'loading' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Abriendo camara y cargando modelos...</p>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <AlertCircle size={28} className="text-red-500" />
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
              <div className="flex gap-2">
                <button onClick={close} className="px-4 py-2 text-sm rounded-xl border text-slate-600">Cerrar</button>
                <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white">Reintentar</button>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={28} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium">
                {mode === 'register' ? 'Rostro registrado!' : 'Rostro reconocido'}
              </p>
              <button onClick={close} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white">Cerrar</button>
            </div>
          )}

          {/* CAMERA / CAPTURING / PROCESSING */}
          {(step === 'camera' || step === 'capturing' || step === 'processing') && (
            <>
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3]">
                {/* VIDEO - SIEMPRE RENDERIZADO */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Ovalo guia */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-40 h-48 rounded-[50%] border-[3px] transition-colors ${
                    step === 'capturing' ? 'border-emerald-400' : 'border-white/50'
                  }`} />
                </div>

                {/* Countdown */}
                {step === 'capturing' && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl font-bold text-white drop-shadow-lg animate-pulse">{countdown}</span>
                  </div>
                )}

                {/* Progress bars */}
                {step === 'capturing' && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {[1, 2, 3].map(s => (
                      <div key={s} className={`w-10 h-2 rounded-full transition-all ${
                        s < captureStep ? 'bg-emerald-400' : s === captureStep ? 'bg-white animate-pulse' : 'bg-white/30'
                      }`} />
                    ))}
                  </div>
                )}

                {/* Processing overlay */}
                {step === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 size={28} className="animate-spin text-white" />
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 text-center mt-3">
                {step === 'camera' && mode === 'register' && 'Mira a la camara y presiona el boton.'}
                {step === 'camera' && mode === 'login' && 'Mira a la camara para identificarte.'}
                {step === 'capturing' && `Captura ${captureStep} de 3 - Quietito`}
                {step === 'processing' && 'Procesando...'}
              </p>

              <div className="flex justify-center mt-4">
                {step === 'camera' && mode === 'register' && (
                  <button onClick={doRegister} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                    <Camera size={16} /> Capturar Rostro
                  </button>
                )}
                {step === 'camera' && mode === 'login' && (
                  <button onClick={doLogin} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                    <Scan size={16} /> Identificarme
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
