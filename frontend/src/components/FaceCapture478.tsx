import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';
import {
  loadFaceLandmarker,
  detectFrame,
  buildTemporalSignature,
  generateFaceSignature478,
  landmarksToFlatArray,
  normalizeLandmarks478,
  FaceScanResult,
  Landmark478,
} from '../services/mediaPipeFace';
import { supabase } from '../services/supabase';

interface FaceCapture478Props {
  mode: 'register' | 'login';
  usuarioId?: number;
  onCapture?: (data: { signature: number[]; landmarks478: number[] }) => void;
  onLoginMatch?: (userId: number, nombre: string) => void;
  onClose: () => void;
}

type Phase = 'loading' | 'scanning' | 'processing' | 'done' | 'error';

export const FaceCapture478: React.FC<FaceCapture478Props> = ({
  mode,
  usuarioId,
  onCapture,
  onLoginMatch,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<FaceScanResult[]>([]);
  const startTimeRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('loading');
  const [statusMsg, setStatusMsg] = useState('Cargando modelo de IA...');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const SCAN_DURATION_MS = 4000;
  const MIN_FRAMES = 10;

  const stopAll = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  // Load MediaPipe and start camera
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setStatusMsg('Cargando modelo de IA...');
        await loadFaceLandmarker();
        if (!alive) return;

        setStatusMsg('Accediendo a la camara...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setPhase('scanning');
        setStatusMsg(mode === 'login' ? 'Mira de frente a la camara...' : 'Mira de frente — Escaneando tu rostro...');
        startTimeRef.current = Date.now();
        framesRef.current = [];

        // Start detection loop
        scanIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;

          const elapsed = Date.now() - startTimeRef.current;
          const progress = Math.min(1, elapsed / SCAN_DURATION_MS);
          setScanProgress(progress);

          const result = detectFrame(video, performance.now());
          if (result && result.landmarks.length >= 478) {
            setFaceDetected(true);
            framesRef.current.push(result);
            setFrameCount(framesRef.current.length);

            // Draw478-point mesh on canvas
            drawMesh(video, result.landmarks);
          } else {
            setFaceDetected(false);
          }

          // Check if scan is complete
          if (elapsed >= SCAN_DURATION_MS && framesRef.current.length >= MIN_FRAMES) {
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
            handleScanComplete();
          }
        }, 100); // ~10 FPS detection
      } catch (err: any) {
        if (!alive) return;
        console.error('[FaceCapture478] Init error:', err);
        if (err?.name === 'NotAllowedError') {
          setErrorMsg('Permiso de camara denegado.');
        } else {
          setErrorMsg(`Error: ${err?.message || String(err)}`);
        }
        setPhase('error');
      }
    })();
    return () => { alive = false; stopAll(); };
  }, [mode, stopAll]);

  const drawMesh = useCallback((video: HTMLVideoElement, landmarks: Landmark478[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);

    // Draw478 points
    for (let i = 0; i < landmarks.length; i++) {
      const l = landmarks[i];
      const px = l.x * w;
      const py = l.y * h;

      let color = 'rgba(0,200,255,0.4)';
      let size = 1;

      // Highlight key regions
      if (i >= 0 && i <= 16) { color = 'rgba(0,200,255,0.6)'; size = 1.5; } // jaw
      else if (i >= 33 && i <= 42) { color = 'rgba(255,80,80,0.7)'; size = 1.5; } // left eye
      else if (i >= 263 && i <= 272) { color = 'rgba(255,80,80,0.7)'; size = 1.5; } // right eye
      else if (i >= 48 && i <= 67) { color = 'rgba(255,180,50,0.6)'; size = 1.5; } // lips
      else if (i >= 27 && i <= 35) { color = 'rgba(0,255,150,0.6)'; size = 1.5; } // nose
      else if (i >= 17 && i <= 26) { color = 'rgba(255,100,100,0.5)'; size = 1.2; } // eyebrows
      else if (i >= 468) { color = 'rgba(200,100,255,0.7)'; size = 2; } // iris

      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
  }, []);

  const handleScanComplete = useCallback(async () => {
    setPhase('processing');
    setStatusMsg('Procesando datos faciales...');

    const temporal = buildTemporalSignature(framesRef.current);
    if (!temporal || temporal.totalFrames < MIN_FRAMES) {
      setErrorMsg('Escaneo insuficiente. Intenta de nuevo con buena iluminacion.');
      setPhase('error');
      return;
    }

    if (temporal.stability < 0.3) {
      setErrorMsg('Moviste mucho la cara. Mantente quieto e intenta de nuevo.');
      setPhase('error');
      return;
    }

    const signature = generateFaceSignature478(temporal.avgLandmarks);
    const landmarks478 = landmarksToFlatArray(normalizeLandmarks478(temporal.avgLandmarks));

    if (mode === 'register' && usuarioId) {
      await doRegister(signature, landmarks478);
    } else if (mode === 'login') {
      await doLogin(signature, landmarks478);
    }
  }, [mode, usuarioId]);

  const doRegister = async (signature: number[], landmarks478: number[]) => {
    try {
      setStatusMsg('Guardando registro facial...');

      // Verify user exists
      const { data: userCheck } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', usuarioId!)
        .maybeSingle();

      if (!userCheck) {
        setErrorMsg('Usuario no encontrado. Crea tu cuenta primero.');
        setPhase('error');
        return;
      }

      // Delete existing face data
      await supabase.from('rostros').delete().eq('usuario_id', usuarioId!);

      // Save new 478-landmark face data
      const { error } = await supabase.from('rostros').insert({
        usuario_id: usuarioId!,
        embedding_frontal: signature,
        landmarks_68: landmarks478,
        forma_rostro: '478pts',
        metadata: {
          engine: 'mediapipe-478',
          landmarks_count: 478,
          scan_frames: framesRef.current.length,
          stability: buildTemporalSignature(framesRef.current)?.stability || 0,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        setErrorMsg('Error guardando: ' + error.message);
        setPhase('error');
        return;
      }

      setSuccessMsg('Rostro registrado correctamente con 478 puntos');
      setPhase('done');
      stopAll();
      if (onCapture) onCapture({ signature, landmarks478 });
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error registrando rostro');
      setPhase('error');
    }
  };

  const doLogin = async (signature: number[], landmarks478: number[]) => {
    try {
      setStatusMsg('Verificando identidad...');

      const { data: rostros, error: queryErr } = await supabase
        .from('rostros')
        .select('usuario_id, embedding_frontal, landmarks_68');

      if (queryErr || !rostros || rostros.length === 0) {
        setErrorMsg('No hay usuarios registrados. Crea tu cuenta primero.');
        setPhase('error');
        return;
      }

      let bestScore = -1;
      let bestUserId = -1;

      for (const r of rostros) {
        // Compare using embedding_frontal (compact signature)
        if (r.embedding_frontal && r.embedding_frontal.length > 0) {
          const storedSig = Array.isArray(r.embedding_frontal)
            ? r.embedding_frontal
            : typeof r.embedding_frontal === 'string'
              ? JSON.parse(r.embedding_frontal)
              : [];

          if (storedSig.length === signature.length) {
            let sumSq = 0;
            for (let i = 0; i < signature.length; i++) {
              sumSq += (signature[i] - storedSig[i]) ** 2;
            }
            const rmsDist = Math.sqrt(sumSq / signature.length);
            const score = Math.max(0, 1 - rmsDist * 5);

            if (score > bestScore) {
              bestScore = score;
              bestUserId = r.usuario_id;
            }
          }
        }

        // Also compare full478 landmarks if available
        if (r.landmarks_68 && r.landmarks_68.length === landmarks478.length) {
          let sumSq = 0;
          for (let i = 0; i < landmarks478.length; i++) {
            const stored = Array.isArray(r.landmarks_68) ? r.landmarks_68 : JSON.parse(r.landmarks_68);
            sumSq += (landmarks478[i] - (stored[i] || 0)) ** 2;
          }
          const rmsDist = Math.sqrt(sumSq / landmarks478.length);
          const score = Math.max(0, 1 - rmsDist * 5);

          if (score > bestScore) {
            bestScore = score;
            bestUserId = r.usuario_id;
          }
        }
      }

      const THRESHOLD = 0.60;
      if (bestScore < THRESHOLD || bestUserId === -1) {
        setErrorMsg('Rostro no reconocido. Debes registrarte primero.');
        setPhase('error');
        return;
      }

      // Verify user still exists
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', bestUserId)
        .maybeSingle();

      if (!usuario) {
        setErrorMsg('Usuario no encontrado.');
        setPhase('error');
        return;
      }

      setSuccessMsg(`Bienvenido ${usuario.nombre}`);
      setPhase('done');
      stopAll();
      if (onLoginMatch) onLoginMatch(usuario.id, usuario.nombre);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error en login facial');
      setPhase('error');
    }
  };

  const handleClose = () => { stopAll(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              {mode === 'register' ? 'Registro Facial 478pts' : 'Verificacion Facial 478pts'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5">
          {phase === 'loading' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">{statusMsg}</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <AlertCircle size={28} className="text-red-500" />
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                Cerrar
              </button>
            </div>
          )}

          {phase === 'processing' && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">{statusMsg}</p>
            </div>
          )}

          {(phase === 'scanning') && (
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
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ zIndex: 5 }}
                />

                {/* Status overlay */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                  <div className="bg-black/60 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-white text-xs">{faceDetected ? '478 puntos activos' : 'Buscando rostro...'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs">Frames: {frameCount}</span>
                    </div>
                  </div>
                  <div className="bg-black/60 rounded-lg px-3 py-2 text-right">
                    <div className="text-xs text-cyan-300 font-bold uppercase">
                      {scanProgress < 0.3 ? 'Detectando' : scanProgress < 0.7 ? 'Escaneando' : 'Completando'}
                    </div>
                    <div className="text-white text-lg font-bold">{Math.round(scanProgress * 100)}%</div>
                  </div>
                </div>

                {/* Scan line effect */}
                <div className="absolute inset-0 pointer-events-none z-6">
                  <div
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    style={{ top: `${scanProgress * 100}%`, opacity: 0.6 }}
                  />
                </div>

                {/* Bottom status */}
                <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10">
                  <div className="bg-black/60 rounded-xl px-5 py-3 text-center">
                    <p className="text-white text-sm font-bold">
                      {faceDetected ? `${frameCount} frames capturados — ${Math.round((1 - scanProgress) * 4)}s restantes` : 'Posiciona tu cara frente a la camara'}
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                      {mode === 'login' ? 'Mantente quieto mientras te identificamos' : 'Mantente quieto — Solo necesitamos vista frontal'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${scanProgress * 100}%`,
                      background: scanProgress < 0.3 ? 'linear-gradient(90deg, #3b82f6, #06b6d4)' : scanProgress < 0.7 ? 'linear-gradient(90deg, #06b6d4, #10b981)' : 'linear-gradient(90deg, #10b981, #22c55e)',
                    }}
                  />
                </div>
                <span className="text-xs text-slate-500 font-mono w-12 text-right">
                  {Math.round(scanProgress * 100)}%
                </span>
              </div>

              <div className="mt-2 text-center text-xs text-slate-400">
                478 puntos faciales con profundidad 3D — MediaPipe AI
              </div>
            </>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={28} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium">{successMsg || 'Completado!'}</p>
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 mt-2">
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
