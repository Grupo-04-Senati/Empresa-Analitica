import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, CheckCircle, AlertCircle, Loader2, User } from 'lucide-react';
import { loadFaceModels, areModelsLoaded, captureEmbedding, averageEmbeddings, saveFaceEmbedding, matchFaceFromCamera } from '../services/faceRecognition';

interface FaceCaptureProps {
  mode: 'register' | 'login';
  userId?: number;
  onCapture?: (embedding: Float32Array) => void;
  onLoginMatch?: (userId: number) => void;
  onClose: () => void;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ mode, userId, onCapture, onLoginMatch, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<'loading' | 'camera' | 'capturing' | 'processing' | 'done' | 'error'>('loading');
  const [countdown, setCountdown] = useState(0);
  const [captureStep, setCaptureStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadMsg, setLoadMsg] = useState('Iniciando camara...');
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const cameraPromise = navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });

      if (!areModelsLoaded()) {
        setLoadMsg('Descargando modelos de IA (~6MB, primera vez)...');
      } else {
        setLoadMsg('Modelos listos, abriendo camara...');
      }

      const modelsPromise = loadFaceModels();

      try {
        setLoadMsg('Accediendo a la camara...');
        const [stream] = await Promise.all([cameraPromise, modelsPromise]);
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStep('camera');
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
    return () => { cancelled = true; stopCamera(); };
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

    const match = await matchFaceFromCamera(videoRef.current);
    setStep('done');
    stopCamera();

    if (match && onLoginMatch) {
      onLoginMatch(match.userId);
    } else if (!match) {
      setErrorMsg('Rostro no reconocido.');
      setStep('error');
    }
  }, [onLoginMatch, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
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
                <button onClick={() => { setErrorMsg(''); setStep('loading'); window.location.reload(); }} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700">
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
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className={`w-40 h-48 rounded-[50%] border-3 ${
                      step === 'capturing' ? 'border-emerald-400' : 'border-white/60'
                    } transition-colors duration-300`}
                    style={{ borderWidth: '3px' }}
                  />
                </div>

                {step === 'capturing' && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl font-bold text-white drop-shadow-lg animate-pulse">
                      {countdown}
                    </span>
                  </div>
                )}

                {step === 'capturing' && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                    {[1, 2, 3].map((s) => (
                      <div
                        key={s}
                        className={`w-8 h-1.5 rounded-full transition-colors ${
                          s <= captureStep ? 'bg-emerald-400' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {step === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="animate-spin text-white" />
                      <span className="text-sm text-white">Procesando...</span>
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
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all"
                  >
                    <Camera size={16} className="inline mr-2" />
                    Capturar Rostro
                  </button>
                )}
                {step === 'camera' && mode === 'login' && (
                  <button
                    onClick={doLoginScan}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all"
                  >
                    <User size={16} className="inline mr-2" />
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
