import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  loadFaceLandmarker,
  detectFrame,
  buildPoseTemplates,
  comparePoseSets,
  poseSetFromRow,
  containMapping,
  MATCH_THRESHOLD,
  MATCH_MIN_MARGIN,
  REGION_FLOOR,
  MIN_QUALITY_FRAMES,
  MIN_SIDE_FRAMES,
  POSE_SIDE_MIN,
  SIGNATURE_VERSION,
  FACE_POSES,
  FacePose,
  FaceScanResult,
  Landmark478,
  PoseTemplateSet,
  FaceMetrics3D,
  METRIC_LABELS,
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

/**
 * El registro barre la cabeza de lado a lado, asi que necesita mas tiempo que
 * el login, que solo confirma la pose frontal.
 */
const SCAN_DURATION_MS = { register: 9000, login: 15000 } as const;
const SCAN_HARD_TIMEOUT_MS = { register: 30000, login: 30000 } as const;
/** Periodo entre detecciones (~12 FPS): suficiente y no saturar la CPU. */
const DETECT_INTERVAL_MS = 80;
/** Cada cuanto se publican los contadores a React (4 veces por segundo). */
const UI_REFRESH_MS = 250;
/**
 * Alto maximo del visor. Deja sitio debajo para las casillas de pose y los
 * botones sin que el modal se salga de la pantalla del movil.
 */
const MAX_PREVIEW_HEIGHT = '50dvh';

const POSE_LABEL: Record<FacePose, string> = {
  izquierda: 'Lado A',
  frontal: 'De frente',
  derecha: 'Lado B',
};

/** Frames que necesita cada pose para dar la plantilla por completa. */
const POSE_TARGET: Record<FacePose, number> = {
  izquierda: MIN_SIDE_FRAMES,
  frontal: MIN_QUALITY_FRAMES,
  derecha: MIN_SIDE_FRAMES,
};

/** Construye el conjunto de indices de una lista de conexiones de MediaPipe. */
function indicesOf(connections: readonly unknown[]): Set<number> {
  const set = new Set<number>();
  for (const c of connections as { start: number; end: number }[]) {
    set.add(c.start);
    set.add(c.end);
  }
  return set;
}

/**
 * Regiones de la malla de 478 puntos, tomadas de las constantes oficiales de
 * MediaPipe. (Antes se usaban rangos de la topologia de 68 puntos de
 * face-api.js, que no corresponden a esta malla: por eso los colores no
 * coincidian con las zonas del rostro.)
 */
const REGIONS = {
  eyes: indicesOf([
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  ]),
  brows: indicesOf([
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  ]),
  iris: indicesOf([
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
    ...FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
  ]),
  lips: indicesOf(FaceLandmarker.FACE_LANDMARKS_LIPS),
  oval: indicesOf(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL),
};

/** Nariz: la malla no tiene constante oficial; se listan puente y punta. */
const NOSE_INDICES = new Set([1, 2, 4, 5, 6, 19, 94, 97, 98, 168, 195, 197, 326, 327]);

const emptyCounts = (): Record<FacePose, number> => ({ izquierda: 0, frontal: 0, derecha: 0 });

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
  /**
   * El bucle va con setInterval y no con requestAnimationFrame: rAF se congela
   * cuando la pestana no se esta dibujando (otra pestana al frente, ventana
   * detras), y con el se congelaria tambien el limite de tiempo del escaneo,
   * dejandolo colgado sin mostrar nunca un error.
   */
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<FaceScanResult[]>([]);
  const poseCountsRef = useRef<Record<FacePose, number>>(emptyCounts());
  const startTimeRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const finishedRef = useRef(false);
  const sawFaceRef = useRef(false);
  /**
   * El bucle corre a ~12 Hz, pero refrescar el estado de React a esa velocidad
   * vuelve a renderizar todo el modal y en un movil eso es justo lo que hace
   * que las animaciones vayan a saltos. Los contadores se publican 4 veces por
   * segundo; el canvas se sigue dibujando en cada deteccion.
   */
  const lastUiPushRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('loading');
  const [statusMsg, setStatusMsg] = useState('Cargando modelo de IA...');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [poseCounts, setPoseCounts] = useState<Record<FacePose, number>>(emptyCounts());
  const [currentPose, setCurrentPose] = useState<FacePose | null>(null);
  /** Giro actual, visible en pantalla: sin esto no hay forma de ver por que una
   *  pose lateral no entra. */
  const [yawRatio, setYawRatio] = useState(0);
  /** Avance de la descarga del motor, o null si no se conoce el total. */
  const [loadFraction, setLoadFraction] = useState<number | null>(null);
  /** Tamano del rostro en el encuadre, para avisar si estas muy lejos o cerca. */
  const [faceWidth, setFaceWidth] = useState(0);
  /**
   * Proporcion ancho/alto del video. El recuadro la adopta para que no haya
   * recorte ni bandas: la camara del movil es vertical y la del portatil
   * horizontal, y con un recuadro fijo 4:3 una de las dos siempre salia mal.
   */
  const [videoAspect, setVideoAspect] = useState(4 / 3);

  /**
   * Registro manual: cada pose se captura al pulsar el boton, no por tiempo.
   * Asi la mascara se congela en el instante que eliges y moverte despues ya no
   * altera los puntos guardados.
   */
  const [captured, setCaptured] = useState<PoseTemplateSet>({});
  const capturedRef = useRef<PoseTemplateSet>({});
  const [captureMsg, setCaptureMsg] = useState('');
  /** Mientras esta congelada no se redibuja la malla: queda fija en pantalla. */
  const frozenRef = useRef(false);
  const [frozen, setFrozen] = useState(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Medidas 3D del rostro registrado, para mostrarlas al terminar. */
  const [savedMetrics, setSavedMetrics] = useState<FaceMetrics3D | null>(null);
  /** Aviso de multiples rostros en cuadro. */
  const [multiFaceWarning, setMultiFaceWarning] = useState(false);

  const duration = SCAN_DURATION_MS[mode];
  const hardTimeout = SCAN_HARD_TIMEOUT_MS[mode];

  const stopAll = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (loopRef.current !== null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (freezeTimerRef.current !== null) {
      clearTimeout(freezeTimerRef.current);
      freezeTimerRef.current = null;
    }
  }, []);

  const fail = useCallback((message: string, hint = '') => {
    setErrorMsg(message);
    setErrorHint(hint);
    setPhase('error');
    stopAll();
  }, [stopAll]);

  /**
   * Estilo de cada region de la malla. Se dibuja UN trazo por grupo en vez de
   * uno por punto: 478 pares beginPath/fill por frame ahogan la GPU de un
   * movil y hacen que la malla se mueva a saltos.
   */
  const MESH_STYLES: { color: string; size: number; test: (i: number) => boolean }[] = [
    // Nariz, boca y ojos van mas grandes y opacos: son las zonas mas
    // distintivas y el usuario necesita verlas destacadas sobre el resto.
    { color: 'rgba(210,120,255,0.95)', size: 2.4, test: i => REGIONS.iris.has(i) },
    { color: 'rgba(255,70,70,0.95)', size: 2.1, test: i => REGIONS.eyes.has(i) },
    { color: 'rgba(0,255,150,0.95)', size: 2.1, test: i => NOSE_INDICES.has(i) },
    { color: 'rgba(255,175,40,0.95)', size: 2.0, test: i => REGIONS.lips.has(i) },
    { color: 'rgba(255,130,130,0.70)', size: 1.3, test: i => REGIONS.brows.has(i) },
    { color: 'rgba(0,220,255,0.65)', size: 1.3, test: i => REGIONS.oval.has(i) },
    // El resto de la malla, tenue, para que se vea el rostro completo.
    { color: 'rgba(0,200,255,0.30)', size: 0.8, test: () => true },
  ];

  /** A que grupo pertenece cada indice. Se resuelve una sola vez. */
  const MESH_GROUP: number[] = (() => {
    const grupos = new Array(478).fill(MESH_STYLES.length - 1);
    for (let i = 0; i < 478; i++) {
      for (let g = 0; g < MESH_STYLES.length; g++) {
        if (MESH_STYLES[g].test(i)) { grupos[i] = g; break; }
      }
    }
    return grupos;
  })();

  const drawMesh = useCallback((landmarks: Landmark478[], video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;

    /*
     * El canvas se dimensiona en pixeles REALES del dispositivo. Sin esto, en
     * un movil con devicePixelRatio 2-3 el canvas se estira y los puntos salen
     * borrosos y desalineados respecto al video.
     */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelW = Math.round(w * dpr);
    const pixelH = Math.round(h * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // `contain`: el frame completo entra en el recuadro. Como el recuadro toma
    // la proporcion de la camara, no hay bandas ni recorte, y la malla cae
    // exactamente sobre el rostro en cualquier camara.
    const { drawnW, drawnH, offsetX, offsetY } = containMapping(
      video.videoWidth, video.videoHeight, w, h
    );

    // El video se muestra espejado (scaleX(-1)); la malla se espeja igual.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    for (let g = 0; g < MESH_STYLES.length; g++) {
      const estilo = MESH_STYLES[g];
      ctx.beginPath();
      let hay = false;
      for (let i = 0; i < landmarks.length; i++) {
        if (MESH_GROUP[i] !== g) continue;
        const l = landmarks[i];
        const px = l.x * drawnW + offsetX;
        const py = l.y * drawnH + offsetY;
        ctx.moveTo(px + estilo.size, py);
        ctx.arc(px, py, estilo.size, 0, Math.PI * 2);
        hay = true;
      }
      if (hay) {
        ctx.fillStyle = estilo.color;
        ctx.fill();
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  /** Ventana de frames que se usa al pulsar "Capturar". */
  const CAPTURE_WINDOW_MS = 2500;

  /**
   * Captura la pose actual: congela la mascara y guarda la plantilla.
   *
   * Toma los frames de los ultimos segundos que correspondan a esa pose, no un
   * solo fotograma: un unico frame trae el ruido de deteccion y da una
   * plantilla peor. La media recortada de buildPoseTemplates descarta ademas
   * los frames en que te moviste.
   */
  const handleCapturePose = useCallback(() => {
    const pose = currentPose;
    if (!pose) {
      setCaptureMsg('Quedate quieto un momento: la cabeza esta entre dos posiciones.');
      return;
    }

    const ahora = performance.now();
    const recientes = framesRef.current.filter(
      f => f.pose === pose && ahora - f.timestamp <= CAPTURE_WINDOW_MS
    );

    const objetivo = POSE_TARGET[pose];
    if (recientes.length < objetivo) {
      setCaptureMsg(
        `Mantente quieto un segundo mas (${recientes.length}/${objetivo} frames de "${POSE_LABEL[pose]}").`
      );
      return;
    }

    const resultado = buildPoseTemplates(recientes);
    const plantilla = resultado.templates[pose];
    if (!plantilla) {
      setCaptureMsg('La captura salio con demasiado movimiento. Intentalo otra vez.');
      return;
    }

    capturedRef.current = { ...capturedRef.current, [pose]: plantilla };
    setCaptured(capturedRef.current);
    setCaptureMsg(
      `"${POSE_LABEL[pose]}" capturado con ${plantilla.frames} frames ` +
      `(estabilidad ${Math.round(plantilla.stability * 100)}%).`
    );

    // Congela la malla un instante como confirmacion visual.
    frozenRef.current = true;
    setFrozen(true);
    if (freezeTimerRef.current !== null) clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = setTimeout(() => {
      frozenRef.current = false;
      setFrozen(false);
    }, 1200);
  }, [currentPose]);

  /**
   * Guarda el registro con las poses que el usuario haya capturado.
   * La frontal es obligatoria; las laterales son opcionales.
   */
  const handleFinishRegister = useCallback(async () => {
    const templates = capturedRef.current;
    if (!templates.frontal) {
      setCaptureMsg('Falta capturar la vista de frente, que es obligatoria.');
      return;
    }

    stopAll();
    setPhase('processing');
    setStatusMsg('Guardando registro facial...');

    const blendshapes = framesRef.current.length
      ? buildPoseTemplates(framesRef.current).avgBlendshapes
      : [];
    const conteos: Record<FacePose, number> = {
      izquierda: templates.izquierda?.frames ?? 0,
      frontal: templates.frontal.frames,
      derecha: templates.derecha?.frames ?? 0,
    };

    await doRegister(templates, blendshapes, conteos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll]);

  /**
   * Login automatico: compara las poses capturadas con los rostros guardados.
   * Requiere al menos la pose frontal.
   */
  const handleFinishLogin = useCallback(async () => {
    const templates = capturedRef.current;
    if (!templates.frontal) {
      setCaptureMsg('No se pudo capturar la vista frontal.');
      return;
    }

    stopAll();
    setPhase('processing');
    setStatusMsg('Verificando identidad...');
    await doLogin(templates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll]);

  // Carga del motor + camara + bucle de deteccion
  useEffect(() => {
    let alive = true;

    if (mode === 'register' && !usuarioId) {
      fail('Falta el usuario para registrar el rostro.', 'Crea la cuenta antes de registrar tu rostro.');
      return;
    }

    (async () => {
      try {
        if (!window.isSecureContext) {
          fail(
            'La camara requiere una conexion segura (HTTPS).',
            `Abre el sitio con https:// o en http://localhost. Origen actual: ${window.location.origin}`
          );
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          fail('Este navegador no permite acceder a la camara.', 'Prueba con Chrome, Edge o Firefox actualizados.');
          return;
        }

        setStatusMsg('Cargando modelo de IA...');
        await loadFaceLandmarker(p => {
          if (!alive) return;
          setStatusMsg(p.message);
          setLoadFraction(p.fraction);
        });
        if (!alive) return;

        setStatusMsg('Accediendo a la camara...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;

        // El <video> se renderiza siempre (oculto fuera de la fase de escaneo)
        // justo para que exista en este punto: si solo se montara al entrar en
        // 'scanning', videoRef seria null aqui y el stream nunca llegaria al
        // elemento, dejando el escaner sin imagen que analizar.
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach(t => t.stop());
          fail('No se pudo montar el visor de video.', 'Recarga la pagina e intentalo de nuevo.');
          return;
        }

        video.srcObject = stream;
        await video.play();

        const fijarProporcion = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setVideoAspect(video.videoWidth / video.videoHeight);
          }
        };
        fijarProporcion();
        // En movil las dimensiones a veces llegan despues del play().
        video.addEventListener('loadedmetadata', fijarProporcion);
        video.addEventListener('resize', fijarProporcion);

        setPhase('scanning');
        setStatusMsg(mode === 'login'
          ? 'Escaneando rostro... mueve la cabeza de lado a lado'
          : 'Gira la cabeza despacio de un lado al otro...');
        startTimeRef.current = performance.now();
        lastVideoTimeRef.current = -1;
        finishedRef.current = false;
        sawFaceRef.current = false;
        framesRef.current = [];
        poseCountsRef.current = emptyCounts();
        lastUiPushRef.current = 0;

        const loop = () => {
          if (!alive || finishedRef.current) return;

          const now = performance.now();
          const elapsed = now - startTimeRef.current;
          const el = videoRef.current;

          // El limite de tiempo se comprueba ANTES de exigir que el video este
          // listo: si la camara se abre pero nunca entrega frames (driver en
          // mal estado, dispositivo ocupado), el escaneo tiene que terminar con
          // un error y no quedarse colgado en 0%.
          const videoReady = !!el && el.readyState >= 2;

          if (videoReady) {
            // No reprocesar el mismo frame: MediaPipe daria un resultado
            // repetido y ensuciaria el promedio con muestras duplicadas.
            if (el!.currentTime !== lastVideoTimeRef.current) {
              lastVideoTimeRef.current = el!.currentTime;

              const result = detectFrame(el!, now);
              if (result) {
                sawFaceRef.current = true;
                framesRef.current.push(result);
                if (result.pose) poseCountsRef.current[result.pose]++;

                // Congelada: se deja en pantalla la ultima malla dibujada.
                if (!frozenRef.current) drawMesh(result.landmarks, el!);

                if (now - lastUiPushRef.current >= UI_REFRESH_MS) {
                  lastUiPushRef.current = now;
                  setFaceDetected(true);
                  setFrameCount(framesRef.current.length);
                  setPoseCounts({ ...poseCountsRef.current });
                  setCurrentPose(result.pose);
                  setYawRatio(result.yawRatio);
                  setFaceWidth(result.faceWidth);
                  // Deteccion de multi-persona
                  setMultiFaceWarning(result.faceCount > 1);
                }
              } else if (now - lastUiPushRef.current >= UI_REFRESH_MS) {
                lastUiPushRef.current = now;
                setFaceDetected(false);
                setCurrentPose(null);
                setMultiFaceWarning(false);
              }
            }
          }

          const counts = poseCountsRef.current;
          const frontalDone = counts.frontal >= POSE_TARGET.frontal;

          if (mode === 'register') {
            /*
             * En registro NO se completa por tiempo: cada pose la captura el
             * usuario con el boton. El progreso refleja las poses ya
             * capturadas, que es lo que de verdad le falta por hacer.
             */
            const hechas = FACE_POSES.filter(pose => capturedRef.current[pose]).length;
            setScanProgress(hechas / 3);

            // Unico corte automatico: la camara da imagen pero no aparece
            // ningun rostro. Sin esto la pantalla se queda esperando sin decir
            // que pasa.
            if (!sawFaceRef.current && elapsed >= hardTimeout) {
              finishedRef.current = true;
              if (!videoReady) {
                fail(
                  'La camara no entrego imagen.',
                  'Cierra otras aplicaciones que usen la camara, revisa que no este tapada y recarga la pagina.'
                );
              } else {
                fail(
                  'No se detecto ningun rostro.',
                  'Centra tu cara en el encuadre, acercate un poco y mejora la iluminacion.'
                );
              }
            }
            return;
          }

          // Login manual: el usuario captura cada pose con los botones.
          // La barra de progreso refleja las poses ya capturadas.
          const hechas = FACE_POSES.filter(pose => capturedRef.current[pose]).length;
          setScanProgress(hechas / 3);

          // Timeout si no se detecta ningun rostro
          if (!sawFaceRef.current && elapsed >= hardTimeout) {
            finishedRef.current = true;
            if (!videoReady) {
              fail(
                'La camara no entrego imagen.',
                'Cierra otras aplicaciones que usen la camara, revisa que no este tapada y recarga la pagina.'
              );
            } else {
              fail(
                'No se detecto ningun rostro.',
                'Centra tu cara en el encuadre, acercate un poco y mejora la iluminacion.'
              );
            }
          }
        };

        loopRef.current = setInterval(loop, DETECT_INTERVAL_MS);
      } catch (err: any) {
        if (!alive) return;
        console.error('[FaceCapture478] Error de inicializacion:', err);
        const msg = String(err?.message || err || '');
        const name = String(err?.name || '');

        if (name === 'NotAllowedError' || msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
          fail(
            'Permiso de camara denegado.',
            'Haz clic en el icono de la camara en la barra de direcciones y permite el acceso.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          fail('No se encontro ninguna camara conectada.', 'Conecta una webcam y vuelve a intentarlo.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          fail('La camara esta en uso por otra aplicacion.', 'Cierra Zoom, Teams, Meet u otra app que use la camara.');
        } else if (msg.includes('Content Security Policy') || msg.includes('script-src') || msg.includes('Refused to load')) {
          fail('El navegador bloqueo la carga del motor facial (CSP).', msg.substring(0, 160));
        } else {
          fail('No se pudo iniciar el escaner facial.', msg.substring(0, 200));
        }
      }
    })();

    return () => { alive = false; finishedRef.current = true; stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, usuarioId]);

  // -------------------------------------------------------------------------
  // Persistencia
  // -------------------------------------------------------------------------

  /**
   * Inserta tolerando esquemas incompletos: si la tabla `rostros` no tiene
   * alguna columna (segun las migraciones que se hayan corrido), Supabase
   * responde PGRST204/42703 nombrando la columna; la quitamos y reintentamos.
   */
  const insertRostro = async (row: Record<string, unknown>): Promise<string | null> => {
    const payload = { ...row };
    const required = ['usuario_id', 'embedding_frontal'];

    for (let attempt = 0; attempt < 10; attempt++) {
      const { error } = await supabase.from('rostros').insert(payload);
      if (!error) return null;

      /*
       * pgvector: si la columna quedo como vector(128) del sistema anterior,
       * Postgres responde "expected 128 dimensions, not 339". Reintentar no
       * sirve: hay que cambiar el tipo de la columna.
       */
      const dims = error.message.match(/expected (\d+) dimensions, not (\d+)/);
      if (dims) {
        return `La columna de la firma facial sigue siendo del tipo antiguo ` +
          `vector(${dims[1]}), y la firma nueva tiene ${dims[2]} valores. ` +
          'Ejecuta database/MIGRATION_478_LANDMARKS.sql en Supabase (SQL Editor) ' +
          'para convertir esas columnas a jsonb, y vuelve a intentarlo.';
      }

      const isMissingColumn = error.code === 'PGRST204' || error.code === '42703';
      const missing = error.message.match(/'([^']+)' column/)?.[1]
        ?? error.message.match(/column "([^"]+)"/)?.[1];

      if (!isMissingColumn || !missing || !(missing in payload)) {
        return error.message;
      }
      if (required.includes(missing)) {
        return `La tabla "rostros" no tiene la columna "${missing}". ` +
          'Ejecuta database/MIGRATION_478_LANDMARKS.sql en Supabase.';
      }

      delete payload[missing];
      console.warn(`[FaceCapture478] La tabla rostros no tiene la columna "${missing}"; se omite.`);
    }
    return 'No se pudo guardar el rostro: el esquema de la tabla "rostros" no es compatible.';
  };

  const doRegister = async (
    templates: PoseTemplateSet,
    avgBlendshapes: { name: string; score: number }[],
    frameCounts: Record<FacePose, number>
  ) => {
    try {
      setStatusMsg('Guardando registro facial...');

      const frontal = templates.frontal!;

      const { data: userCheck, error: userErr } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', usuarioId!)
        .maybeSingle();

      if (userErr) {
        fail('No se pudo verificar el usuario.', userErr.message);
        return;
      }
      if (!userCheck) {
        fail('Usuario no encontrado.', 'Crea tu cuenta antes de registrar el rostro.');
        return;
      }

      /*
       * Orden a proposito: primero se INSERTA el rostro nuevo y solo despues se
       * borran las filas anteriores.
       *
       * Antes se borraba primero, asi que si el INSERT fallaba (por ejemplo por
       * el tipo de columna) te quedabas sin el rostro anterior Y sin el nuevo.
       * Asi, si algo falla, no se guarda nada y lo que ya tenias sigue intacto.
       */
      const { data: filasPrevias } = await supabase
        .from('rostros')
        .select('id')
        .eq('usuario_id', usuarioId!);

      const capturedPoses = FACE_POSES.filter(p => templates[p]);

      const insertError = await insertRostro({
        usuario_id: usuarioId!,
        // Una firma por pose, en las columnas que ya existian en el esquema.
        embedding_frontal: frontal.signature,
        embedding_izquierda: templates.izquierda?.signature ?? null,
        embedding_derecha: templates.derecha?.signature ?? null,
        // Columnas de la migracion 478
        face_signature: frontal.signature,
        landmarks_478: frontal.landmarks478,
        // Medidas antropometricas 3D en unidades interoculares: pomulos,
        // mandibula, proyeccion de la nariz, profundidad de cuencas, etc.
        medidas_3d: frontal.metrics,
        blendshapes: avgBlendshapes,
        /*
         * No se escribe landmarks_68: guardaba una copia identica de
         * landmarks_478 (10.3 KB por fila, un tercio del total) y no daba
         * compatibilidad real, porque el sistema antiguo espera 68 puntos, no
         * 478. La columna se deja en la tabla por si hay datos viejos.
         */
        forma_rostro: '478pts',
        metadata: {
          engine: 'mediapipe-478',
          signature_version: SIGNATURE_VERSION,
          signature_length: frontal.signature.length,
          landmarks_count: 478,
          poses: capturedPoses,
          pose_frames: frameCounts,
          pose_stability: Object.fromEntries(
            capturedPoses.map(p => [p, templates[p]!.stability])
          ),
          stability: frontal.stability,
          timestamp: new Date().toISOString(),
        },
      });

      if (insertError) {
        // No se borro nada: el registro anterior (si habia) sigue en su sitio.
        fail('Error guardando el rostro.', insertError);
        return;
      }

      // Guardado confirmado: ahora si se retiran las filas anteriores.
      if (filasPrevias?.length) {
        const previos = filasPrevias.map(f => f.id);
        const { error: delErr } = await supabase.from('rostros').delete().in('id', previos);
        if (delErr) {
          // El rostro nuevo ya esta guardado; solo quedo un duplicado viejo.
          console.warn('[FaceCapture478] no se pudieron borrar los rostros anteriores:', delErr.message);
        }
      }

      setSavedMetrics(frontal.metrics);
      setSuccessMsg(
        `Rostro registrado: ${capturedPoses.length} pose(s) con 478 puntos ` +
        `(estabilidad ${Math.round(frontal.stability * 100)}%)`
      );
      setPhase('done');
      if (onCapture) onCapture({ signature: frontal.signature, landmarks478: frontal.landmarks478 });
    } catch (e: any) {
      fail('Error registrando el rostro.', e?.message || String(e));
    }
  };

  const doLogin = async (templates: PoseTemplateSet) => {
    try {
      setStatusMsg('Verificando identidad...');

      // select('*') evita fallar si la tabla no tiene alguna columna concreta.
      const { data: rostros, error: queryErr } = await supabase.from('rostros').select('*');

      if (queryErr) {
        fail('No se pudo consultar los rostros registrados.', queryErr.message);
        return;
      }
      if (!rostros || rostros.length === 0) {
        fail('No hay rostros registrados todavia.', 'Registra tu rostro desde la pantalla de registro.');
        return;
      }

      let best = {
        score: -1,
        userId: -1,
        poses: [] as FacePose[],
        weakestRegion: '',
        weakestScore: 0,
        frontalRegions: null as Record<string, number> | null,
      };
      let second = { score: -1, userId: -1 };
      let incompatible = 0;

      for (const r of rostros as Record<string, any>[]) {
        // Una firma de otra version no es comparable: la normalizacion cambio.
        const version = r.metadata?.signature_version;
        if (version && version !== SIGNATURE_VERSION) { incompatible++; continue; }

        const stored = poseSetFromRow(r);
        const match = comparePoseSets(templates, stored);
        if (match.posesCompared.length === 0) { incompatible++; continue; }

        if (match.similarity > best.score) {
          second = { score: best.score, userId: best.userId };
          best = {
            score: match.similarity,
            userId: r.usuario_id,
            poses: match.posesCompared,
            weakestRegion: match.weakestRegion,
            weakestScore: match.weakestScore,
            frontalRegions: match.frontalRegions,
          };
        } else if (match.similarity > second.score) {
          second = { score: match.similarity, userId: r.usuario_id };
        }
      }

      if (best.userId === -1) {
        fail(
          incompatible > 0
            ? 'Los rostros guardados son de una version anterior del escaner.'
            : 'No hay rostros comparables registrados.',
          incompatible > 0
            ? `${incompatible} registro(s) deben volver a capturarse desde la pantalla de registro.`
            : 'Registra tu rostro desde la pantalla de registro.'
        );
        return;
      }

      console.log(
        `[FaceCapture478] mejor=${best.score.toFixed(3)} (usuario ${best.userId}, ` +
        `poses ${best.poses.join('+')}) segundo=${second.score >= 0 ? second.score.toFixed(3) : 'n/a'} ` +
        `incompatibles=${incompatible}`
      );
      if (best.frontalRegions) {
        console.log('[FaceCapture478] similitud por region:', best.frontalRegions);
      }

      if (best.score < MATCH_THRESHOLD) {
        fail(
          'Rostro no reconocido.',
          `Similitud ${Math.round(best.score * 100)}%, se necesita ${Math.round(MATCH_THRESHOLD * 100)}%. ` +
          'Mejora la iluminacion, quitate lentes o gorra, o vuelve a registrar tu rostro.'
        );
        return;
      }

      /*
       * Todas las regiones tienen que coincidir, no solo el promedio. Sin esto,
       * un parecido fuerte en unas zonas puede arrastrar el promedio por encima
       * del umbral aunque otras zonas del rostro no cuadren en absoluto: es el
       * camino por el que una persona termina entrando en la cuenta de otra.
       */
      if (best.weakestScore < REGION_FLOOR) {
        fail(
          'Rostro no reconocido (una zona del rostro no coincide).',
          `La zona "${best.weakestRegion}" solo coincide al ${Math.round(best.weakestScore * 100)}%, ` +
          `se necesita ${Math.round(REGION_FLOOR * 100)}%. Si eres tu, vuelve a registrar tu rostro ` +
          'con buena luz y sin lentes ni gorra.'
        );
        return;
      }

      // En identificacion 1:N, dos candidatos casi empatados significan que la
      // captura no distingue entre personas: es mas seguro rechazar que
      // arriesgarse a entrar en la cuenta equivocada.
      if (second.score >= 0 && best.score - second.score < MATCH_MIN_MARGIN) {
        fail(
          'No se pudo confirmar tu identidad con seguridad.',
          'Hay dos rostros registrados demasiado parecidos entre si. ' +
          'Inicia sesion con correo y contrasena.'
        );
        return;
      }

      const { data: usuario, error: userErr } = await supabase
        .from('usuarios')
        .select('id, nombre, email')
        .eq('id', best.userId)
        .maybeSingle();

      if (userErr) {
        fail('No se pudo cargar el usuario reconocido.', userErr.message);
        return;
      }
      if (!usuario) {
        // Rostro huerfano: el usuario fue borrado pero su fila quedo en rostros.
        fail(
          'El usuario reconocido ya no existe.',
          'Su cuenta fue eliminada. Registra tu rostro de nuevo.'
        );
        return;
      }

      setSuccessMsg(`Bienvenido ${usuario.nombre} (${Math.round(best.score * 100)}% de coincidencia)`);
      setPhase('done');
      if (onLoginMatch) onLoginMatch(usuario.id, usuario.nombre);
    } catch (e: any) {
      fail('Error en el login facial.', e?.message || String(e));
    }
  };

  const handleClose = () => { stopAll(); onClose(); };

  const isRegister = mode === 'register';
  /** Una pose esta lista cuando el usuario la capturo con el boton. */
  const poseDone = (p: FacePose) => !!captured[p];
  const puedeCapturar = faceDetected && currentPose !== null && !frozen;

  /*
   * Aviso de distancia. faceWidth es el ancho pomulo a pomulo como fraccion
   * del ancho del encuadre: por debajo de 0.12 MediaPipe pierde precision y la
   * captura "se hace dificil"; por encima de 0.60 el rostro se sale del borde.
   * La COMPARACION no depende de la distancia (esta normalizada), solo la
   * calidad de la deteccion.
   */
  const avisoDistancia = !faceDetected
    ? ''
    : faceWidth < 0.12
      ? 'Estas muy lejos: acercate a la camara'
      : faceWidth > 0.60
        ? 'Estas muy cerca: alejate un poco'
        : '';

  const guidance = (() => {
    if (!faceDetected) return 'Posiciona tu cara frente a la camara';
    if (multiFaceWarning) return 'Solo debe haber una persona en cuadro';
    if (avisoDistancia) return avisoDistancia;
    if (frozen) return 'Captura tomada';

    if (!isRegister) {
      const hechas = FACE_POSES.filter(p => captured[p]).length;
      if (hechas >= 3) return 'Verificando identidad...';
      if (!captured.frontal) return 'Mira de frente y pulsa Capturar';
      if (!captured.izquierda) return 'Gira a la izquierda y pulsa Capturar';
      if (!captured.derecha) return 'Gira a la derecha y pulsa Capturar';
    }

    // Registro
    if (!captured.frontal) return 'Mira de frente y pulsa Capturar';
    if (!captured.izquierda && !captured.derecha) return 'Gira la cabeza a un lado y pulsa Capturar';
    if (!captured.izquierda || !captured.derecha) return 'Gira al otro lado y pulsa Capturar';
    return 'Las tres poses listas: pulsa Guardar rostro';
  })();

  const subGuidance = (() => {
    if (multiFaceWarning) return 'Retira a las demas personas del encuadre';
    const hechas = FACE_POSES.filter(p => captured[p]).length;
    if (!isRegister) {
      if (hechas >= 3) return 'Todas las poses capturadas — pulsa Verificar identidad';
      const currentPoseLabel = !captured.frontal ? 'Frontal' : !captured.izquierda ? 'Lado A' : 'Lado B';
      return `${hechas}/3 — Escaneando ${currentPoseLabel}`;
    }
    if (hechas >= 3) return 'Todas las poses listas';
    return currentPose
      ? `Posicion detectada: ${POSE_LABEL[currentPose]}`
      : 'Cabeza entre dos posiciones: quedate quieto un momento';
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      {/*
        En movil el modal ocupa casi toda la pantalla y su contenido tiene
        scroll propio: con el video vertical, las tres casillas de pose y los
        botones, antes no cabia y quedaba cortado.
        100dvh en vez de 100vh para que la barra del navegador movil no lo tape.
      */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100dvh - 1rem)' }}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800">
              {isRegister ? 'Registro Facial 478pts' : 'Verificacion Facial 478pts'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto">
          {(phase === 'loading' || phase === 'processing') && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm text-slate-500 text-center px-4">{statusMsg}</p>

              {/* Sin barra, una descarga de 15 MB por un tunel parece colgada. */}
              {phase === 'loading' && loadFraction !== null && (
                <>
                  <div className="w-56 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.round(loadFraction * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {Math.round(loadFraction * 100)}% — solo la primera vez
                  </p>
                </>
              )}
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <AlertCircle size={28} className="text-red-500" />
              <p className="text-sm text-red-600 text-center font-medium">{errorMsg}</p>
              {errorHint && (
                <p className="text-xs text-slate-500 text-center max-w-sm">{errorHint}</p>
              )}
              <button onClick={handleClose} className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 mt-1">
                Cerrar
              </button>
            </div>
          )}

          {/* Se monta siempre: el elemento <video> tiene que existir antes de
              asignarle el stream de la camara, que ocurre en la fase de carga. */}
          <div className={phase === 'scanning' ? '' : 'hidden'}>
            <>
              {/*
                El recuadro toma la proporcion de la camara y se limita en alto
                para que en movil quepan debajo las poses y los botones.
                `object-contain` no recorta nada: al coincidir la proporcion, no
                deja bandas, y la malla encaja exacta (ver containMapping).
              */}
              {/*
                El tope va en el ANCHO, no en el alto: con `max-height` y ancho
                estirado el navegador incumple la proporcion (medido: 0.805 en
                vez de 0.75) y aparecen bandas laterales. Limitando el ancho a
                alto_maximo x proporcion, la proporcion se respeta exacta.
              */}
              <div
                className="relative rounded-xl overflow-hidden bg-slate-900 mx-auto w-full"
                style={{
                  aspectRatio: String(videoAspect),
                  maxWidth: `calc(${MAX_PREVIEW_HEIGHT} * ${videoAspect})`,
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ zIndex: 5 }}
                />

                <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex justify-between items-start gap-2 z-10">
                  {/* min-w-0 + wrap: en movil el texto se cortaba contra la
                      insignia de la derecha en vez de pasar a dos lineas. */}
                  <div className="bg-black/60 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 space-y-0.5 min-w-0">
                    <div className="flex items-start gap-1.5">
                      <div className={`w-2 h-2 mt-1 shrink-0 rounded-full ${faceDetected ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-white text-[10px] sm:text-xs leading-tight">
                        {faceDetected ? '478 puntos activos' : 'Buscando rostro...'}
                      </span>
                    </div>
                    <span className="text-white/70 text-[10px] sm:text-xs block">Frames: {frameCount}</span>
                    {faceDetected && (
                      <span className="text-white/70 text-[10px] sm:text-xs block">
                        Giro: {yawRatio >= 0 ? '+' : ''}{yawRatio.toFixed(2)}
                        {currentPose === 'frontal' ? ` (gira a +-${POSE_SIDE_MIN})` : ''}
                      </span>
                    )}
                  </div>
                  <div className="bg-black/60 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-right shrink-0">
                    <div className="text-xs text-cyan-300 font-bold uppercase">
                      {currentPose ? POSE_LABEL[currentPose] : 'Girando'}
                    </div>
                    <div className="text-white text-lg font-bold">{Math.round(scanProgress * 100)}%</div>
                  </div>
                </div>

                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 6 }}>
                  <div
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                    style={{ top: `${scanProgress * 100}%`, opacity: 0.6 }}
                  />
                </div>

                <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 flex justify-center z-10">
                  <div className="bg-black/70 rounded-xl px-3 py-2 sm:px-5 sm:py-3 text-center max-w-full">
                    <p className="text-white text-xs sm:text-sm font-bold leading-snug">{guidance}</p>
                    <p className="text-white/60 text-[10px] sm:text-xs mt-0.5 sm:mt-1 leading-snug">{subGuidance}</p>
                  </div>
                </div>

                {/* Aviso de multi-persona: overlay rojo sobre la camara */}
                {multiFaceWarning && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="bg-red-600/90 rounded-xl px-4 py-3 text-center">
                      <AlertCircle size={24} className="text-white mx-auto mb-1" />
                      <p className="text-white text-sm font-bold">Solo una persona</p>
                      <p className="text-white/80 text-xs">Retira a las demas personas del encuadre</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Indicadores de pose: siempre visibles */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {FACE_POSES.map(pose => {
                  const done = poseDone(pose);
                  const active = currentPose === pose;
                  const plantilla = captured[pose];
                  return (
                    <div
                      key={pose}
                      className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                        done
                          ? 'border-emerald-300 bg-emerald-50'
                          : active
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {done && <CheckCircle size={12} className="text-emerald-500" />}
                        <span className={`text-xs font-semibold ${done ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {POSE_LABEL[pose]}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {plantilla
                          ? `${plantilla.frames} frames`
                          : isRegister ? 'obligatoria' : 'escaneando...'}
                      </div>
                    </div>
                  );
                })}
              </div>

               {/* Botones: registro y login */}
               <div className="mt-3 flex flex-col sm:flex-row gap-2">
                 <button
                   onClick={handleCapturePose}
                   disabled={!puedeCapturar}
                   className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                 >
                   {currentPose ? `Capturar ${POSE_LABEL[currentPose]}` : 'Capturar'}
                 </button>
                 {isRegister ? (
                   <button
                     onClick={handleFinishRegister}
                     disabled={!captured.frontal || !captured.izquierda || !captured.derecha}
                     className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                   >
                     Guardar rostro
                   </button>
                 ) : (
                   <button
                     onClick={handleFinishLogin}
                     disabled={!captured.frontal || !captured.izquierda || !captured.derecha}
                     className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                   >
                     Verificar identidad
                   </button>
                 )}
               </div>

              {captureMsg && (
                <p className="mt-2 text-xs text-center text-slate-600">{captureMsg}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${scanProgress * 100}%`,
                      background: scanProgress < 0.34
                        ? 'linear-gradient(90deg, #3b82f6, #06b6d4)'
                        : scanProgress < 0.67
                          ? 'linear-gradient(90deg, #06b6d4, #10b981)'
                          : 'linear-gradient(90deg, #10b981, #22c55e)',
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
          </div>

          {phase === 'done' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={28} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium text-center">{successMsg || 'Completado!'}</p>

              {/* Medidas 3D guardadas. Estan en unidades interoculares (la
                  distancia entre los ojos vale 1), asi que son las mismas
                  estes cerca o lejos de la camara. */}
              {savedMetrics && (
                <div className="w-full mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">
                    Medidas 3D de tu rostro guardadas
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {(Object.keys(savedMetrics) as (keyof FaceMetrics3D)[]).map(clave => (
                      <div key={clave} className="flex justify-between text-[11px]">
                        <span className="text-slate-500">{METRIC_LABELS[clave]}</span>
                        <span className="font-mono text-slate-700">{savedMetrics[clave].toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    En unidades interoculares: no cambian con la distancia a la camara.
                  </p>
                </div>
              )}
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
