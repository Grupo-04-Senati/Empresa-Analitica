/**
 * MediaPipe Face Landmarker — 478 landmarks con profundidad (x, y, z).
 * Reemplaza el sistema de 68 puntos de face-api.js.
 *
 * Distribucion de los 478 landmarks:
 *   0-467   : malla de la superficie del rostro (x, y normalizados [0,1], z profundidad)
 *   468-477 : iris (5 puntos por ojo)
 *
 * IMPORTANTE sobre las coordenadas crudas de MediaPipe:
 *   - x esta normalizado al ANCHO de la imagen, y al ALTO. Si el video no es
 *     cuadrado, x e y NO estan en la misma escala: hay que corregir el aspecto
 *     antes de medir distancias, o la forma del rostro sale deformada.
 *   - z esta aproximadamente en unidades de ancho de imagen, con origen cerca
 *     del centro de la cabeza.
 *
 * La normalizacion (normalizeLandmarks478) deja la malla invariante a:
 *   posicion, escala/distancia a la camara, aspecto del video e inclinacion
 *   lateral de la cabeza (roll). El resultado esta en "unidades interoculares".
 */

import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * Debe coincidir EXACTAMENTE con la version de @mediapipe/tasks-vision en
 * package.json. El glue JS del paquete npm y los binarios .wasm son un par
 * acoplado: mezclar versiones rompe la creacion del FaceLandmarker.
 */
const TASKS_VISION_VERSION = '1.0.1';

/** WASM servido por nosotros (generado en predev/prebuild). Siempre en version. */
const LOCAL_WASM_BASE = '/wasm';
/** Respaldo si la copia local falta (p. ej. build sin node_modules). */
const CDN_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;

const MODEL_URL = '/models/face_landmarker.task';

/** Tamano minimo plausible del modelo .task (el real pesa ~3.7 MB). */
const MIN_MODEL_BYTES = 1_000_000;

const MODEL_FETCH_TIMEOUT_MS = 30_000;
const LANDMARKER_INIT_TIMEOUT_MS = 30_000;

/**
 * Version del formato de firma facial. Cambiala si se modifica la
 * normalizacion o los indices de la firma: los rostros guardados con otra
 * version no son comparables y hay que volver a registrarlos.
 */
export const SIGNATURE_VERSION = 'mediapipe-478-v2';

/**
 * Calibracion de la metrica de comparacion (RMS en unidades interoculares),
 * medida sobre malla normalizada, pose frontal y captura estable:
 *   mismo rostro       -> ~0.012 a 0.045
 *   personas distintas -> ~0.075 en adelante
 */
const RMS_SAME_PERSON = 0.020;
const RMS_DIFFERENT_PERSON = 0.085;

/** Similitud minima para aceptar un login facial. */
export const MATCH_THRESHOLD = 0.55;
/** Ventaja minima del mejor candidato sobre el segundo (evita falsos positivos 1:N). */
export const MATCH_MIN_MARGIN = 0.08;

let faceLandmarker: FaceLandmarker | null = null;
let loadingPromise: Promise<FaceLandmarker> | null = null;

/**
 * detectForVideo exige timestamps estrictamente crecientes durante toda la
 * vida del landmarker. Como el landmarker es un singleton que sobrevive al
 * desmontaje del componente, el reloj tiene que ser de modulo: si cada montaje
 * reiniciara el timestamp en 0, la segunda apertura del escaner fallaria en
 * cada frame ("timestamp must be monotonically increasing").
 */
let lastTimestampMs = 0;

export interface Landmark478 {
  x: number;
  y: number;
  z: number;
}

/**
 * Poses que se capturan en el registro, barriendo la cabeza de lado a lado.
 * La etiqueta es el lado de la IMAGEN hacia el que apunta la nariz, no la
 * anatomia del usuario: lo unico que importa es que registro y login usen el
 * mismo criterio para emparejar plantillas.
 */
export type FacePose = 'izquierda' | 'frontal' | 'derecha';

export const FACE_POSES: FacePose[] = ['izquierda', 'frontal', 'derecha'];

/**
 * Umbrales sobre yawRatio (magnitud sin unidades, no grados).
 *
 * La zona frontal es ancha a proposito: en el login el usuario casi nunca esta
 * perfectamente de frente, y si un giro minimo lo sacara de la pose frontal no
 * habria con que comparar. La banda muerta entre ambos umbrales descarta los
 * frames en transicion, que son los que tienen la cabeza en movimiento.
 *
 * Con las proporciones de la malla de MediaPipe, 0.18 equivale a unos 8 grados
 * de giro y 0.22 a unos 10. Registro y login usan los mismos umbrales, asi que
 * el emparejamiento de poses es consistente aunque la escala no sea exacta.
 *
 * El umbral lateral se bajo de 0.30 a 0.22 tras probar en movil: mirando la
 * pantalla del telefono la cabeza gira muy poco y las poses laterales no
 * llegaban a entrar nunca.
 */
export const POSE_CENTER_MAX = 0.18;
export const POSE_SIDE_MIN = 0.22;

export interface FaceScanResult {
  landmarks: Landmark478[];
  /** Malla ya normalizada (se calcula una sola vez por frame). */
  normalized: Landmark478[];
  blendshapes: { name: string; score: number }[];
  faceWidth: number;
  faceHeight: number;
  /** Aspecto (alto/ancho) del frame de origen; necesario para normalizar. */
  aspect: number;
  /** 0..1 — que tan de frente esta el rostro (1 = frontal perfecto). */
  frontality: number;
  /** Inclinacion lateral de la cabeza en grados. */
  rollDegrees: number;
  /**
   * Giro horizontal de la cabeza en [-1, 1]: 0 = de frente, negativo y
   * positivo = girada a cada lado de la imagen.
   */
  yawRatio: number;
  /** Pose discreta, o null si esta en la zona de transicion entre dos. */
  pose: FacePose | null;
  confidence: number;
  timestamp: number;
}

export interface TemporalFaceData {
  frames: FaceScanResult[];
  avgLandmarks: Landmark478[];
  avgBlendshapes: { name: string; score: number }[];
  stability: number;
  totalFrames: number;
  /** Frames que superaron el filtro de calidad y se promediaron. */
  usedFrames: number;
}

/** Plantilla facial de una sola pose. */
export interface PoseTemplate {
  pose: FacePose;
  signature: number[];
  landmarks478: number[];
  stability: number;
  frames: number;
  /** Medidas antropometricas 3D (solo se calculan para la pose frontal). */
  metrics: FaceMetrics3D | null;
}

/** Conjunto de plantillas de un rostro, indexado por pose. */
export type PoseTemplateSet = Partial<Record<FacePose, PoseTemplate>>;

export interface PoseCaptureResult {
  templates: PoseTemplateSet;
  /** Frames validos que cayeron en cada pose. */
  frameCounts: Record<FacePose, number>;
  avgBlendshapes: { name: string; score: number }[];
}

export interface PoseMatchResult {
  /** Similitud combinada [0,1] sobre las poses que ambos lados tienen. */
  similarity: number;
  /** Poses efectivamente comparadas. */
  posesCompared: FacePose[];
  /** Similitud por pose, para diagnostico. */
  perPose: Partial<Record<FacePose, number>>;
  /** Region peor emparejada de todas las poses, y su puntuacion. */
  weakestRegion: string;
  weakestScore: number;
  /** Similitud por region de la pose frontal, para diagnostico. */
  frontalRegions: Record<string, number> | null;
}

export class FaceEngineError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'FaceEngineError';
  }
}

// ---------------------------------------------------------------------------
// Carga del motor
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new FaceEngineError(`${label} excedio el tiempo limite (${ms / 1000}s)`)),
      ms
    );
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

/**
 * Lee el cuerpo de una respuesta informando del avance.
 *
 * Content-Length llega comprimido cuando hay Content-Encoding, asi que el total
 * es orientativo: se usa solo para la barra de progreso, nunca para validar.
 * Si el navegador no expone el stream, cae a arrayBuffer() sin progreso.
 */
async function readWithProgress(
  res: Response,
  onBytes?: (loaded: number, total: number) => void
): Promise<ArrayBuffer> {
  const total = Number(res.headers.get('content-length')) || 0;

  if (!onBytes || !res.body || typeof res.body.getReader !== 'function') {
    return res.arrayBuffer();
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onBytes(loaded, total);
    }
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

/**
 * Descarga el modelo .task y lo valida.
 *
 * Lo bajamos nosotros (en vez de pasar modelAssetPath) para poder distinguir
 * los fallos reales: si el rewrite del SPA devuelve index.html en lugar del
 * binario, MediaPipe solo diria "Aborted" sin explicar nada.
 */
async function fetchModelBuffer(
  onBytes?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(MODEL_URL, { signal: controller.signal, cache: 'force-cache' });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      throw new FaceEngineError(
        `La descarga del modelo facial tardo mas de ${MODEL_FETCH_TIMEOUT_MS / 1000}s.`
      );
    }
    throw new FaceEngineError(
      `No se pudo descargar el modelo facial (${MODEL_URL}): ${e?.message || e}`, e
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    throw new FaceEngineError(
      `El modelo facial no esta disponible (HTTP ${res.status} en ${MODEL_URL}). ` +
      'Verifica que face_landmarker.task este publicado en /models.'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new FaceEngineError(
      `La ruta ${MODEL_URL} devolvio HTML en lugar del modelo. ` +
      'El rewrite del SPA esta capturando /models: revisa vercel.json.'
    );
  }

  const buffer = new Uint8Array(await readWithProgress(res, onBytes));
  if (buffer.byteLength < MIN_MODEL_BYTES) {
    throw new FaceEngineError(
      `El modelo facial descargado esta incompleto (${buffer.byteLength} bytes). ` +
      'Vuelve a subir /models/face_landmarker.task.'
    );
  }
  return buffer;
}

/**
 * Comprueba que el loader WASM exista en la base indicada antes de intentar
 * inicializar: un 404 dentro de emscripten aborta de forma opaca.
 *
 * Primero con HEAD y, si el host no lo soporta, con un GET de un solo byte.
 */
async function wasmBaseIsUsable(base: string): Promise<boolean> {
  let url: string;
  try {
    url = (await FilesetResolver.forVisionTasks(base)).wasmLoaderPath;
  } catch {
    return false;
  }

  const looksValid = (res: Response) =>
    res.ok && !(res.headers.get('content-type') || '').includes('text/html');

  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
    if (looksValid(head)) return true;
  } catch {
    // Sigue con el GET parcial.
  }

  try {
    const ranged = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'force-cache' });
    return looksValid(ranged);
  } catch {
    return false;
  }
}

async function createLandmarker(base: string, modelBuffer: Uint8Array): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(base);

  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetBuffer: modelBuffer, delegate },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    minFaceDetectionConfidence: 0.4,
    minFacePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
    outputFaceBlendshapes: true,
  });

  try {
    return await withTimeout(
      FaceLandmarker.createFromOptions(vision, options('GPU')),
      LANDMARKER_INIT_TIMEOUT_MS,
      'Inicializacion GPU de MediaPipe'
    );
  } catch (gpuErr: any) {
    console.warn('[MediaPipe] GPU no disponible, usando CPU:', gpuErr?.message || gpuErr);
    return await withTimeout(
      FaceLandmarker.createFromOptions(vision, options('CPU')),
      LANDMARKER_INIT_TIMEOUT_MS,
      'Inicializacion CPU de MediaPipe'
    );
  }
}

export interface FaceLoadProgress {
  message: string;
  loadedBytes: number;
  totalBytes: number;
  /** 0..1 mientras se descarga; null cuando no hay total conocido. */
  fraction: number | null;
}

let lastProgress: FaceLoadProgress = {
  message: 'Cargando modelo de IA...',
  loadedBytes: 0,
  totalBytes: 0,
  fraction: null,
};
/**
 * Varios sitios pueden esperar la misma carga (el precalentamiento de la
 * pantalla de login y el propio escaner). Todos reciben el avance, no solo
 * quien la arranco.
 */
const progressListeners = new Set<(p: FaceLoadProgress) => void>();

function emitProgress(p: Partial<FaceLoadProgress>): void {
  lastProgress = { ...lastProgress, ...p };
  for (const listener of progressListeners) {
    try { listener(lastProgress); } catch { /* un listener roto no corta la carga */ }
  }
}

/**
 * Descarga el binario WASM por adelantado para poder informar del avance.
 *
 * MediaPipe lo pide por su cuenta, sin exponer progreso, y son ~11 MB de los
 * ~15 MB totales: sin esto la pantalla se queda en "Cargando modelo de IA..."
 * sin moverse y parece colgada. Al descargarlo aqui queda en la cache HTTP y
 * la peticion de MediaPipe se resuelve desde ella.
 *
 * Si falla no pasa nada: MediaPipe lo descargara igual.
 */
async function prefetchWasm(
  base: string,
  onBytes: (loaded: number, total: number) => void
): Promise<number> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(base);
    const res = await fetch(fileset.wasmBinaryPath, { cache: 'force-cache' });
    if (!res.ok) return 0;
    const buf = await readWithProgress(res, onBytes);
    return buf.byteLength;
  } catch (e: any) {
    console.warn('[MediaPipe] no se pudo precargar el WASM:', e?.message || e);
    return 0;
  }
}

function formatMB(bytes: number): string {
  return (bytes / 1048576).toFixed(1);
}

export async function loadFaceLandmarker(
  onProgress?: (p: FaceLoadProgress) => void
): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker;

  if (onProgress) {
    progressListeners.add(onProgress);
    onProgress(lastProgress);   // estado actual si la carga ya iba en marcha
  }

  try {
    if (loadingPromise) return await loadingPromise;
    return await startLoading();
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

async function startLoading(): Promise<FaceLandmarker> {
  loadingPromise = (async () => {
    const localUsable = await wasmBaseIsUsable(LOCAL_WASM_BASE);
    if (!localUsable) {
      console.warn(
        `[MediaPipe] ${LOCAL_WASM_BASE} no disponible; usando CDN. ` +
        'Ejecuta "npm run copy-wasm" en frontend/ para servirlo localmente.'
      );
    }

    const bases = localUsable
      ? [LOCAL_WASM_BASE, CDN_WASM_BASE]
      : [CDN_WASM_BASE, LOCAL_WASM_BASE];

    // 1. Motor de vision (~11 MB sin comprimir, ~3.3 MB con gzip).
    emitProgress({
      message: 'Descargando motor de vision...',
      loadedBytes: 0,
      totalBytes: 0,
      fraction: 0,
    });
    let wasmLoaded = 0;
    let wasmTotal = 0;
    await prefetchWasm(bases[0], (loaded, total) => {
      wasmLoaded = loaded;
      wasmTotal = total;
      emitProgress({
        message: total
          ? `Descargando motor de vision ${formatMB(loaded)} / ${formatMB(total)} MB`
          : `Descargando motor de vision ${formatMB(loaded)} MB`,
        loadedBytes: loaded,
        totalBytes: total,
        fraction: total ? (loaded / total) * 0.5 : null,
      });
    });

    // 2. Modelo facial (~3.6 MB).
    const modelBuffer = await fetchModelBuffer((loaded, total) => {
      emitProgress({
        message: total
          ? `Descargando modelo facial ${formatMB(loaded)} / ${formatMB(total)} MB`
          : `Descargando modelo facial ${formatMB(loaded)} MB`,
        loadedBytes: wasmLoaded + loaded,
        totalBytes: wasmTotal + total,
        fraction: total ? 0.5 + (loaded / total) * 0.45 : null,
      });
    });

    // 3. Arranque del motor (compilar el WASM y montar el grafo).
    emitProgress({ message: 'Iniciando motor de vision...', fraction: 0.95 });

    let lastErr: unknown;
    for (const base of bases) {
      try {
        console.log(`[MediaPipe] Inicializando FaceLandmarker (wasm: ${base})`);
        const landmarker = await createLandmarker(base, modelBuffer);
        console.log('[MediaPipe] FaceLandmarker listo');
        faceLandmarker = landmarker;
        lastTimestampMs = 0;
        emitProgress({ message: 'Motor facial listo', fraction: 1 });
        return landmarker;
      } catch (e) {
        lastErr = e;
        console.warn(`[MediaPipe] Fallo con wasm de ${base}:`, (e as any)?.message || e);
      }
    }

    throw new FaceEngineError(
      `No se pudo iniciar el motor facial: ${(lastErr as any)?.message || lastErr}`,
      lastErr
    );
  })();

  try {
    return await loadingPromise;
  } catch (e) {
    // Permite reintentar tras un fallo, en vez de quedar cacheado el rechazo.
    loadingPromise = null;
    throw e;
  }
}

/**
 * Arranca la descarga del motor sin esperarla.
 *
 * Se llama al entrar en login o registro, para que los ~15 MB bajen mientras
 * el usuario escribe sus datos y el escaner abra ya listo, en vez de empezar a
 * descargar cuando pulsa el boton.
 */
export function warmUpFaceEngine(): void {
  if (faceLandmarker || loadingPromise) return;
  startLoading().catch(e => {
    console.warn('[MediaPipe] precalentamiento fallido:', e?.message || e);
  });
}

export function isLoaded(): boolean {
  return faceLandmarker !== null;
}

// ---------------------------------------------------------------------------
// Deteccion
// ---------------------------------------------------------------------------

/** Indices de referencia de la malla de 478 puntos. */
const IDX = {
  noseTip: 1,
  noseBridge: 168,
  chin: 152,
  forehead: 10,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftCheek: 234,
  rightCheek: 454,
} as const;

/**
 * Detecta los 478 landmarks de un frame de video.
 *
 * El timestamp se fuerza a ser monotono a nivel de modulo: MediaPipe rechaza
 * timestamps que no crecen y el landmarker vive mas que el componente.
 */
export function detectFrame(video: HTMLVideoElement, timestampMs?: number): FaceScanResult | null {
  if (!faceLandmarker) return null;

  const ts = Math.max(timestampMs ?? performance.now(), lastTimestampMs + 1);
  lastTimestampMs = ts;

  try {
    const result: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, ts);
    if (!result.faceLandmarks || result.faceLandmarks.length === 0) return null;

    const faceLandmarks = result.faceLandmarks[0];
    if (faceLandmarks.length < 478) return null;

    const blendshapes = (result.faceBlendshapes as any)?.[0]?.categories?.map((bs: any) => ({
      name: bs.categoryName,
      score: bs.score,
    })) || [];

    const landmarks: Landmark478[] = faceLandmarks.map(l => ({ x: l.x, y: l.y, z: l.z }));

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const aspect = height / width;
    const normalized = normalizeLandmarks478(landmarks, aspect);
    const yawRatio = yawRatioOf(normalized);

    const faceWidth = Math.abs(landmarks[IDX.rightCheek].x - landmarks[IDX.leftCheek].x);
    const faceHeight = Math.abs(landmarks[IDX.chin].y - landmarks[IDX.forehead].y) * aspect;

    // Roll: angulo de la linea entre las esquinas externas de los ojos.
    const le = landmarks[IDX.leftEyeOuter];
    const re = landmarks[IDX.rightEyeOuter];
    const rollDegrees = (Math.atan2((re.y - le.y) * aspect, re.x - le.x) * 180) / Math.PI;

    // Frontalidad: en pose frontal la nariz equidista de ambos ojos.
    const nose = landmarks[IDX.noseTip];
    const dLeft = Math.hypot(nose.x - le.x, (nose.y - le.y) * aspect);
    const dRight = Math.hypot(nose.x - re.x, (nose.y - re.y) * aspect);
    const asymmetry = Math.abs(dLeft - dRight) / Math.max(1e-6, (dLeft + dRight) / 2);
    const frontality = Math.max(0, 1 - asymmetry * 2);

    return {
      landmarks,
      normalized,
      blendshapes,
      faceWidth,
      faceHeight,
      aspect,
      frontality,
      rollDegrees,
      yawRatio,
      pose: classifyPose(yawRatio),
      confidence: frontality,
      timestamp: ts,
    };
  } catch (e) {
    console.error('[MediaPipe] Error de deteccion:', e);
    return null;
  }
}

/**
 * Giro horizontal de la cabeza, en [-1, 1], a partir de la malla normalizada.
 *
 * Al girar la cabeza, la proyeccion comprime el lado que se aleja de la camara:
 * la nariz deja de equidistar de los pomulos. Se mide esa asimetria en lugar de
 * usar la matriz de pose de MediaPipe porque asi es una funcion pura de los
 * landmarks, verificable con datos sinteticos (npm run test:face).
 *
 * El signo indica el lado de la IMAGEN hacia el que apunta la nariz.
 */
export function yawRatioOf(normalized: Landmark478[]): number {
  if (normalized.length < 478) return 0;
  const nose = normalized[IDX.noseTip];
  const cheekL = normalized[IDX.leftCheek];
  const cheekR = normalized[IDX.rightCheek];

  const dL = Math.abs(nose.x - cheekL.x);
  const dR = Math.abs(cheekR.x - nose.x);
  const total = dL + dR;
  if (total < 1e-6) return 0;

  return Math.max(-1, Math.min(1, (dL - dR) / total));
}

/** Clasifica el giro en una pose, o null si esta entre dos (transicion). */
export function classifyPose(yawRatio: number): FacePose | null {
  const mag = Math.abs(yawRatio);
  if (mag <= POSE_CENTER_MAX) return 'frontal';
  if (mag < POSE_SIDE_MIN) return null;
  return yawRatio < 0 ? 'izquierda' : 'derecha';
}

// ---------------------------------------------------------------------------
// Medidas antropometricas 3D
// ---------------------------------------------------------------------------

/**
 * Medidas del rostro en UNIDADES INTEROCULARES (la distancia entre los
 * extremos de los ojos vale 1).
 *
 * Al estar divididas por esa distancia son invariantes a lo cerca o lejos que
 * estes de la camara: los mismos pomulos miden lo mismo a 30 cm que a 80 cm.
 * Es lo que hace que la equivalencia funcione a cualquier distancia.
 *
 * Las que empiezan por "profundidad" o "proyeccion" usan el eje z, que es la
 * parte 3D de la malla: describen huecos y relieves (cuanto sobresale la nariz,
 * cuanto se hunden las cuencas de los ojos) y no solo el contorno plano.
 *
 * Ojo con lo que son: se derivan de los mismos 478 landmarks que la firma, asi
 * que no aportan informacion NUEVA al emparejamiento (la firma ya incluye la z
 * de los 113 puntos clave). Sirven para guardar y mostrar la anatomia de forma
 * legible, y para diagnosticar por que dos rostros se parecen o no.
 */
export interface FaceMetrics3D {
  anchoPomulos: number;
  anchoMandibula: number;
  anchoBoca: number;
  anchoNariz: number;
  altoRostro: number;
  altoNariz: number;
  altoFrente: number;
  /** Cuanto sobresale la punta de la nariz respecto al plano de los pomulos. */
  proyeccionNariz: number;
  /** Hundimiento de las cuencas oculares respecto al puente de la nariz. */
  profundidadCuencas: number;
  /**
   * Cuanto sobresale el arco cigomatico respecto al contorno lateral del
   * rostro: es lo que se percibe como "pomulos marcados".
   */
  relievePomulos: number;
  /**
   * Hundimiento de la mejilla justo por debajo del pomulo. En un rostro
   * delgado es pronunciado; con mas grasa facial se rellena y baja.
   */
  huecoMejillas: number;
  /** Relieve total del rostro (recorrido del eje z). */
  profundidadRostro: number;
  /** Proporcion ancho/alto: describe la forma general del rostro. */
  relacionAnchoAlto: number;
}

/** Etiquetas legibles para mostrar en pantalla. */
export const METRIC_LABELS: Record<keyof FaceMetrics3D, string> = {
  anchoPomulos: 'Ancho de pomulos',
  anchoMandibula: 'Ancho de mandibula',
  anchoBoca: 'Ancho de boca',
  anchoNariz: 'Ancho de nariz',
  altoRostro: 'Alto del rostro',
  altoNariz: 'Alto de nariz',
  altoFrente: 'Alto de frente',
  proyeccionNariz: 'Proyeccion de nariz',
  profundidadCuencas: 'Profundidad de cuencas',
  relievePomulos: 'Relieve de pomulos',
  huecoMejillas: 'Hueco de mejillas',
  profundidadRostro: 'Relieve total',
  relacionAnchoAlto: 'Relacion ancho/alto',
};

function dist3(a: Landmark478, b: Landmark478): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Arco cigomatico (el "hueso del pomulo") y la mejilla justo debajo, a cada
 * lado. Se promedian varios landmarks porque uno solo arrastra el ruido de
 * deteccion del frame.
 */
const POMULO_ARCO = [118, 119, 120, 347, 348, 349];
const MEJILLA_HUECO = [205, 425];
/** Contorno lateral del rostro a la altura del pomulo. */
const CONTORNO_LATERAL = [234, 454];

function mediaZ(p: Landmark478[], indices: number[]): number {
  let suma = 0;
  for (const i of indices) suma += p[i].z;
  return suma / indices.length;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Calcula las medidas 3D a partir de la malla YA NORMALIZADA.
 */
export function computeFaceMetrics3D(normalized: Landmark478[]): FaceMetrics3D | null {
  if (normalized.length < 478) return null;

  const p = normalized;
  const pomuloIzq = p[234];
  const pomuloDer = p[454];
  const narizPunta = p[1];
  const narizPuente = p[168];
  const menton = p[152];
  const frente = p[10];

  const anchoPomulos = dist3(pomuloIzq, pomuloDer);
  const altoRostro = dist3(frente, menton);

  // Plano de los pomulos como referencia de profundidad.
  const zPomulos = (pomuloIzq.z + pomuloDer.z) / 2;
  const zOjos = (p[133].z + p[362].z) / 2;   // esquinas internas de los ojos

  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < 468; i++) {            // 468-477 son el iris, se excluyen
    if (p[i].z < zMin) zMin = p[i].z;
    if (p[i].z > zMax) zMax = p[i].z;
  }

  return {
    anchoPomulos: round3(anchoPomulos),
    anchoMandibula: round3(dist3(p[172], p[397])),
    anchoBoca: round3(dist3(p[61], p[291])),
    anchoNariz: round3(dist3(p[98], p[327])),
    altoRostro: round3(altoRostro),
    altoNariz: round3(dist3(narizPuente, p[2])),
    altoFrente: round3(dist3(frente, p[9])),
    proyeccionNariz: round3(Math.abs(narizPunta.z - zPomulos)),
    profundidadCuencas: round3(Math.abs(zOjos - narizPuente.z)),
    /*
     * Se usa el valor absoluto porque el signo de z de MediaPipe no se puede
     * confirmar sin una camara real. Para identificar da igual: lo que importa
     * es que el valor sea estable en la misma persona, y lo es.
     */
    relievePomulos: round3(Math.abs(mediaZ(p, POMULO_ARCO) - mediaZ(p, CONTORNO_LATERAL))),
    huecoMejillas: round3(Math.abs(mediaZ(p, MEJILLA_HUECO) - mediaZ(p, POMULO_ARCO))),
    profundidadRostro: round3(zMax - zMin),
    relacionAnchoAlto: round3(altoRostro > 0 ? anchoPomulos / altoRostro : 0),
  };
}

/**
 * Diferencia relativa entre dos juegos de medidas, por medida.
 * 0 = identicas. Sirve para diagnostico, no como criterio de login.
 */
export function compareFaceMetrics3D(
  a: FaceMetrics3D,
  b: FaceMetrics3D
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const clave of Object.keys(a) as (keyof FaceMetrics3D)[]) {
    const va = a[clave];
    const vb = b[clave];
    const escala = Math.max(Math.abs(va), Math.abs(vb), 1e-6);
    out[clave] = round3(Math.abs(va - vb) / escala);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dibujo de la malla sobre el video
// ---------------------------------------------------------------------------

export interface CoverMapping {
  /** Ancho y alto del video una vez escalado con object-cover. */
  drawnW: number;
  drawnH: number;
  /** Desplazamiento del recorte (negativo en el eje recortado). */
  offsetX: number;
  offsetY: number;
}

/**
 * Calcula como CSS `object-fit: cover` coloca un video dentro de su recuadro:
 * escala por el mayor de los dos factores y recorta lo que sobra, centrado.
 *
 * Hace falta para pintar los landmarks encima del video. MediaPipe los entrega
 * en coordenadas [0,1] del frame COMPLETO; multiplicarlos por el tamano del
 * recuadro solo acierta si el video tiene justo esa proporcion. Con una camara
 * vertical de movil dentro de un recuadro 4:3, el error es enorme y la malla
 * aparece comprimida y desplazada respecto al rostro.
 */
export function fitMapping(
  videoW: number,
  videoH: number,
  boxW: number,
  boxH: number,
  mode: 'cover' | 'contain' = 'cover'
): CoverMapping {
  if (videoW <= 0 || videoH <= 0) {
    return { drawnW: boxW, drawnH: boxH, offsetX: 0, offsetY: 0 };
  }
  // cover escala al mayor factor y recorta; contain al menor y deja bandas.
  const scale = mode === 'cover'
    ? Math.max(boxW / videoW, boxH / videoH)
    : Math.min(boxW / videoW, boxH / videoH);
  const drawnW = videoW * scale;
  const drawnH = videoH * scale;
  return {
    drawnW,
    drawnH,
    offsetX: (boxW - drawnW) / 2,
    offsetY: (boxH - drawnH) / 2,
  };
}

export function coverMapping(
  videoW: number,
  videoH: number,
  boxW: number,
  boxH: number
): CoverMapping {
  return fitMapping(videoW, videoH, boxW, boxH, 'cover');
}

/**
 * Variante `object-fit: contain`: el frame entero cabe dentro del recuadro y
 * sobran bandas, en vez de recortarse.
 *
 * Es la que usa el escaner: no se pierde nada de lo que ve el modelo y, si el
 * recuadro lleva la misma proporcion que la camara, no hay bandas ni recorte
 * (contain y cover coinciden). Asi la malla encaja igual en cualquier camara,
 * horizontal de portatil o vertical de movil.
 */
export function containMapping(
  videoW: number,
  videoH: number,
  boxW: number,
  boxH: number
): CoverMapping {
  return fitMapping(videoW, videoH, boxW, boxH, 'contain');
}

// ---------------------------------------------------------------------------
// Normalizacion
// ---------------------------------------------------------------------------

/**
 * Normaliza los 478 landmarks para que sean invariantes a posicion, escala,
 * aspecto del video e inclinacion lateral (roll).
 *
 * @param aspect alto/ancho del frame de origen (FaceScanResult.aspect).
 * @returns malla en unidades interoculares, centrada entre los ojos.
 */
export function normalizeLandmarks478(landmarks: Landmark478[], aspect = 1): Landmark478[] {
  if (landmarks.length < 478) return landmarks;

  // 1. Espacio isotropo: x e y pasan a las mismas unidades (ancho de imagen).
  const pts = landmarks.map(l => ({ x: l.x, y: l.y * aspect, z: l.z }));

  const le = pts[IDX.leftEyeOuter];
  const re = pts[IDX.rightEyeOuter];

  // 2. Origen en el punto medio entre ojos (mas estable que la punta de la
  //    nariz, que se desplaza con los gestos).
  const cx = (le.x + re.x) / 2;
  const cy = (le.y + re.y) / 2;
  const cz = (le.z + re.z) / 2;

  // 3. Rotacion que deja la linea de los ojos horizontal.
  const angle = Math.atan2(re.y - le.y, re.x - le.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  // 4. Escala = distancia interocular 2D (el eje z es mas ruidoso).
  const interOcular = Math.hypot(re.x - le.x, re.y - le.y) || 1;

  return pts.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return {
      x: (dx * cos - dy * sin) / interOcular,
      y: (dx * sin + dy * cos) / interOcular,
      z: (p.z - cz) / interOcular,
    };
  });
}

// ---------------------------------------------------------------------------
// Firma facial
// ---------------------------------------------------------------------------

/**
 * Indices que componen la firma compacta: regiones rigidas y distintivas.
 * Se excluye a proposito el contorno interno de los labios (cambia al hablar).
 * El orden es fijo y ordenado: cambiarlo invalida las firmas ya guardadas.
 */
export type FaceRegion =
  | 'nariz' | 'ojoIzq' | 'ojoDer' | 'labios' | 'mandibula' | 'cejas' | 'pomulos';

/**
 * La firma se organiza por REGIONES del rostro, no como una lista plana.
 *
 * Asi cada region se puede comparar por separado y exigir que TODAS coincidan
 * (ver compareSignaturesByRegion). Con una sola distancia global, muchas zonas
 * mediocres pueden sumar un promedio aprobatorio, o una nariz muy parecida
 * puede arrastrar al resto: es justo como una persona acaba entrando en la
 * cuenta de otra.
 */
const SIGNATURE_REGIONS: Record<FaceRegion, number[]> = {
  // Nariz (muy distintiva y rigida)
  nariz: [1, 2, 4, 5, 6, 19, 94, 98, 168, 195, 197, 327],
  ojoIzq: [7, 33, 133, 144, 145, 153, 154, 155, 157, 158, 159, 160, 161, 163, 173, 246],
  ojoDer: [249, 263, 362, 373, 374, 380, 381, 382, 384, 385, 386, 387, 388, 390, 398, 466],
  // Contorno externo de labios (el interno cambia al hablar y se excluye)
  labios: [0, 17, 61, 84, 91, 146, 181, 267, 269, 270, 291, 314, 321, 375, 405, 409],
  mandibula: [
    58, 93, 132, 136, 148, 149, 150, 152, 172, 176, 234, 288, 323, 356, 361, 365,
    378, 379, 389, 397, 400, 454,
  ],
  cejas: [9, 10, 63, 66, 70, 105, 107, 151, 293, 296, 300, 334, 336],
  pomulos: [
    50, 101, 118, 119, 120, 123, 147, 187, 205, 280, 330, 348, 349, 350, 352, 376, 411, 425,
  ],
};

export const FACE_REGIONS = Object.keys(SIGNATURE_REGIONS) as FaceRegion[];

/**
 * Orden fijo y ordenado de la firma. Cambiarlo invalida las firmas guardadas,
 * asi que si se toca hay que subir SIGNATURE_VERSION.
 */
const SIGNATURE_INDICES: number[] =
  [...new Set(FACE_REGIONS.flatMap(r => SIGNATURE_REGIONS[r]))].sort((a, b) => a - b);

/** Cantidad de valores de una firma valida (3 por indice). */
export const SIGNATURE_LENGTH = SIGNATURE_INDICES.length * 3;

/**
 * Posicion de cada region dentro del array plano de la firma.
 * Se calcula una vez: cada landmark ocupa 3 valores consecutivos.
 */
const REGION_SLOTS: Record<FaceRegion, number[]> = (() => {
  const posOf = new Map(SIGNATURE_INDICES.map((idx, pos) => [idx, pos * 3]));
  const slots = {} as Record<FaceRegion, number[]>;
  for (const region of FACE_REGIONS) {
    slots[region] = SIGNATURE_REGIONS[region]
      .map(idx => posOf.get(idx))
      .filter((v): v is number => v !== undefined);
  }
  return slots;
})();

/**
 * Similitud minima que debe alcanzar CADA region por separado.
 *
 * Es la condicion que hace las regiones dependientes entre si: aunque el
 * promedio sea alto, si una sola zona del rostro no cuadra, no es la misma
 * persona y se rechaza.
 */
export const REGION_FLOOR = 0.35;

export interface RegionMatch {
  /** Media de las similitudes por region (cada region pesa igual). */
  overall: number;
  perRegion: Record<FaceRegion, number>;
  /** Region peor emparejada y su puntuacion. */
  weakestRegion: FaceRegion;
  weakestScore: number;
}

/**
 * Compara dos firmas region por region.
 *
 * El promedio pondera igual cada region, de modo que la mandibula (22 puntos)
 * no pesa el doble que las cejas (13) solo por tener mas landmarks.
 */
export function compareSignaturesByRegion(a: number[], b: number[]): RegionMatch | null {
  if (!a || !b || a.length !== SIGNATURE_LENGTH || b.length !== SIGNATURE_LENGTH) return null;

  const perRegion = {} as Record<FaceRegion, number>;
  let weakestRegion: FaceRegion = FACE_REGIONS[0];
  let weakestScore = Infinity;
  let suma = 0;

  for (const region of FACE_REGIONS) {
    const slots = REGION_SLOTS[region];
    let sumSq = 0;
    for (const base of slots) {
      for (let k = 0; k < 3; k++) {
        const d = a[base + k] - b[base + k];
        sumSq += d * d;
      }
    }
    const rms = Math.sqrt(sumSq / (slots.length * 3));
    const score = rmsToSimilarity(rms);
    perRegion[region] = score;
    suma += score;
    if (score < weakestScore) {
      weakestScore = score;
      weakestRegion = region;
    }
  }

  return {
    overall: Math.round((suma / FACE_REGIONS.length) * 1000) / 1000,
    perRegion,
    weakestRegion,
    weakestScore,
  };
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/**
 * Genera la firma compacta a partir de la malla PROMEDIADA Y NORMALIZADA.
 */
export function generateFaceSignature478(normalizedAvgLandmarks: Landmark478[]): number[] {
  const signature: number[] = [];
  for (const i of SIGNATURE_INDICES) {
    const l = normalizedAvgLandmarks[i];
    if (!l) return [];
    signature.push(round4(l.x), round4(l.y), round4(l.z));
  }
  return signature;
}

/** Distancia RMS entre dos firmas, en unidades interoculares. Infinity si no comparan. */
export function signatureDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return Infinity;
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / a.length);
}

/** Convierte una distancia RMS en similitud [0,1] segun la calibracion. */
export function rmsToSimilarity(rms: number): number {
  if (!Number.isFinite(rms)) return 0;
  const s = (RMS_DIFFERENT_PERSON - rms) / (RMS_DIFFERENT_PERSON - RMS_SAME_PERSON);
  return Math.max(0, Math.min(1, Math.round(s * 1000) / 1000));
}

/** Compara dos firmas compactas. 1 = identicas. */
export function compareSignatures478(a: number[], b: number[]): number {
  return rmsToSimilarity(signatureDistance(a, b));
}

/** Compara dos mallas completas ya normalizadas. */
export function compareLandmarks478(a: Landmark478[], b: Landmark478[]): number {
  if (a.length !== b.length || a.length < 478) return 0;
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    sumSq += (a[i].x - b[i].x) ** 2 + (a[i].y - b[i].y) ** 2 + (a[i].z - b[i].z) ** 2;
  }
  return rmsToSimilarity(Math.sqrt(sumSq / (a.length * 3)));
}

// ---------------------------------------------------------------------------
// Agregacion temporal
// ---------------------------------------------------------------------------

function meanShape(frames: Landmark478[][]): Landmark478[] {
  const n = frames.length;
  const out: Landmark478[] = new Array(478);
  for (let i = 0; i < 478; i++) {
    let sx = 0, sy = 0, sz = 0;
    for (const f of frames) {
      sx += f[i].x; sy += f[i].y; sz += f[i].z;
    }
    out[i] = { x: sx / n, y: sy / n, z: sz / n };
  }
  return out;
}

function rmsToShape(frame: Landmark478[], shape: Landmark478[]): number {
  let sumSq = 0;
  for (let i = 0; i < 478; i++) {
    sumSq += (frame[i].x - shape[i].x) ** 2
      + (frame[i].y - shape[i].y) ** 2
      + (frame[i].z - shape[i].z) ** 2;
  }
  return Math.sqrt(sumSq / (478 * 3));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Frames minimos con calidad suficiente para la plantilla frontal. */
export const MIN_QUALITY_FRAMES = 8;
/** Las poses laterales duran menos en un barrido, asi que se exigen menos. */
export const MIN_SIDE_FRAMES = 5;

/**
 * Construye la plantilla facial a partir de los frames capturados.
 *
 * Usa una media recortada: descarta los frames que se alejan de la forma
 * mediana (parpadeos, temblor, transiciones) antes de promediar, para que la
 * plantilla guardada no quede contaminada.
 *
 * No filtra por frontalidad: los frames deben venir ya agrupados por pose
 * (ver buildPoseTemplates), y una pose lateral tiene frontalidad baja por
 * definicion.
 */
export function buildTemporalSignature(
  frames: FaceScanResult[],
  minFrames: number = MIN_QUALITY_FRAMES
): TemporalFaceData | null {
  // Filtro de calidad: malla completa, sin inclinacion lateral fuerte y con
  // tamano suficiente en el encuadre.
  const usable = frames.filter(f =>
    f.landmarks.length >= 478 &&
    Math.abs(f.rollDegrees) <= 20 &&
    f.faceWidth >= 0.12
  );

  const pool = usable.length >= minFrames
    ? usable
    : frames.filter(f => f.landmarks.length >= 478);

  if (pool.length < minFrames) return null;

  const normalized = pool.map(f => f.normalized ?? normalizeLandmarks478(f.landmarks, f.aspect));

  // Media recortada: 1a pasada -> forma de referencia, 2a pasada -> solo los
  // frames cercanos a ella.
  const rough = meanShape(normalized);
  const deviations = normalized.map(f => rmsToShape(f, rough));
  const cutoff = Math.max(median(deviations) * 1.5, 0.004);

  const keptIdx = deviations
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d <= cutoff)
    .map(({ i }) => i);

  const finalIdx = keptIdx.length >= minFrames
    ? keptIdx
    : deviations
        .map((d, i) => ({ d, i }))
        .sort((a, b) => a.d - b.d)
        .slice(0, Math.max(minFrames, Math.ceil(normalized.length * 0.6)))
        .map(({ i }) => i);

  const keptShapes = finalIdx.map(i => normalized[i]);
  const keptFrames = finalIdx.map(i => pool[i]);
  const avgLandmarks = meanShape(keptShapes);

  // Blendshapes promedio de los frames conservados.
  const bsSums = new Map<string, { sum: number; count: number }>();
  for (const frame of keptFrames) {
    for (const bs of frame.blendshapes) {
      const entry = bsSums.get(bs.name) || { sum: 0, count: 0 };
      entry.sum += bs.score;
      entry.count++;
      bsSums.set(bs.name, entry);
    }
  }
  const avgBlendshapes = Array.from(bsSums.entries()).map(([name, { sum, count }]) => ({
    name,
    score: Math.round((sum / count) * 1000) / 1000,
  }));

  // Estabilidad: dispersion mediana respecto a la forma final.
  // ~0.004 interocular es una captura muy quieta; ~0.03 es muy movida.
  const finalDeviation = median(keptShapes.map(f => rmsToShape(f, avgLandmarks)));
  const stability = Math.max(0, Math.min(1, 1 - (finalDeviation - 0.004) / 0.026));

  return {
    frames: keptFrames,
    avgLandmarks,
    avgBlendshapes,
    stability: Math.round(stability * 1000) / 1000,
    totalFrames: pool.length,
    usedFrames: keptShapes.length,
  };
}

// ---------------------------------------------------------------------------
// Captura multi-pose (barrido de lado a lado)
// ---------------------------------------------------------------------------

/**
 * Agrupa los frames de un barrido por pose y construye una plantilla de cada
 * una. La plantilla frontal es obligatoria; las laterales son opcionales y
 * anaden robustez cuando en el login el usuario no esta perfectamente de
 * frente.
 *
 * Los frames en transicion entre dos poses (pose === null) se descartan: son
 * los que mas ruido meten, porque la cabeza esta en movimiento.
 */
export function buildPoseTemplates(frames: FaceScanResult[]): PoseCaptureResult {
  const byPose: Record<FacePose, FaceScanResult[]> = {
    izquierda: [],
    frontal: [],
    derecha: [],
  };

  for (const f of frames) {
    if (f.landmarks.length < 478) continue;
    const pose = f.pose ?? classifyPose(f.yawRatio ?? 0);
    if (pose) byPose[pose].push(f);
  }

  const templates: PoseTemplateSet = {};
  const frameCounts: Record<FacePose, number> = { izquierda: 0, frontal: 0, derecha: 0 };
  const blendshapeSums = new Map<string, { sum: number; count: number }>();

  for (const pose of FACE_POSES) {
    const poseFrames = byPose[pose];
    frameCounts[pose] = poseFrames.length;

    const minFrames = pose === 'frontal' ? MIN_QUALITY_FRAMES : MIN_SIDE_FRAMES;
    const temporal = buildTemporalSignature(poseFrames, minFrames);
    if (!temporal) continue;

    const signature = generateFaceSignature478(temporal.avgLandmarks);
    if (signature.length !== SIGNATURE_LENGTH) continue;

    templates[pose] = {
      pose,
      signature,
      landmarks478: landmarksToFlatArray(temporal.avgLandmarks),
      stability: temporal.stability,
      frames: temporal.usedFrames,
      // Solo en la frontal: de lado, la mitad del rostro queda oculta y las
      // medidas de anchura saldrian falseadas por la perspectiva.
      metrics: pose === 'frontal' ? computeFaceMetrics3D(temporal.avgLandmarks) : null,
    };

    for (const bs of temporal.avgBlendshapes) {
      const entry = blendshapeSums.get(bs.name) || { sum: 0, count: 0 };
      entry.sum += bs.score;
      entry.count++;
      blendshapeSums.set(bs.name, entry);
    }
  }

  return {
    templates,
    frameCounts,
    avgBlendshapes: Array.from(blendshapeSums.entries()).map(([name, { sum, count }]) => ({
      name,
      score: Math.round((sum / count) * 1000) / 1000,
    })),
  };
}

/**
 * Compara dos conjuntos de plantillas emparejando pose con pose.
 *
 * Combina las poses comparables con la MEDIA, no con el maximo: tomar el mejor
 * de varios intentos multiplica la probabilidad de falso positivo, que es
 * justo el fallo que dejaba entrar a una persona en la cuenta de otra.
 */
export function comparePoseSets(a: PoseTemplateSet, b: PoseTemplateSet): PoseMatchResult {
  const perPose: Partial<Record<FacePose, number>> = {};
  const posesCompared: FacePose[] = [];
  let weakestRegion = '';
  let weakestScore = Infinity;
  let frontalRegions: Record<string, number> | null = null;

  for (const pose of FACE_POSES) {
    const ta = a[pose];
    const tb = b[pose];
    if (!ta || !tb) continue;

    // Comparacion por regiones: cada zona del rostro cuenta por separado.
    const region = compareSignaturesByRegion(ta.signature, tb.signature);
    if (!region) continue;

    perPose[pose] = region.overall;
    posesCompared.push(pose);

    if (pose === 'frontal') frontalRegions = region.perRegion;
    if (region.weakestScore < weakestScore) {
      weakestScore = region.weakestScore;
      weakestRegion = `${region.weakestRegion} (${pose})`;
    }
  }

  if (posesCompared.length === 0) {
    return {
      similarity: 0,
      posesCompared: [],
      perPose,
      weakestRegion: '',
      weakestScore: 0,
      frontalRegions: null,
    };
  }

  const sum = posesCompared.reduce((acc, p) => acc + (perPose[p] ?? 0), 0);
  return {
    similarity: Math.round((sum / posesCompared.length) * 1000) / 1000,
    posesCompared,
    perPose,
    weakestRegion,
    weakestScore: Math.round(weakestScore * 1000) / 1000,
    frontalRegions,
  };
}

/** Reconstruye un PoseTemplateSet desde una fila de la tabla `rostros`. */
export function poseSetFromRow(row: Record<string, any>): PoseTemplateSet {
  const set: PoseTemplateSet = {};
  const columns: Record<FacePose, string[]> = {
    // embedding_frontal es tambien donde guardaba la firma el sistema anterior.
    frontal: ['embedding_frontal', 'face_signature'],
    izquierda: ['embedding_izquierda'],
    derecha: ['embedding_derecha'],
  };

  for (const pose of FACE_POSES) {
    for (const column of columns[pose]) {
      const signature = toNumberArray(row[column]);
      if (signature.length === SIGNATURE_LENGTH) {
        set[pose] = { pose, signature, landmarks478: [], stability: 0, frames: 0, metrics: null };
        break;
      }
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// Serializacion
// ---------------------------------------------------------------------------

/** Aplana una malla a [x0,y0,z0, x1,y1,z1, ...] (1434 valores). */
export function landmarksToFlatArray(landmarks: Landmark478[]): number[] {
  const arr: number[] = [];
  for (const l of landmarks) {
    arr.push(round4(l.x), round4(l.y), round4(l.z));
  }
  return arr;
}

/** Reconstruye una malla desde el array plano. */
export function flatArrayToLandmarks(arr: number[]): Landmark478[] {
  const landmarks: Landmark478[] = [];
  for (let i = 0; i + 2 < arr.length; i += 3) {
    landmarks.push({ x: arr[i], y: arr[i + 1], z: arr[i + 2] });
  }
  return landmarks;
}

/**
 * Normaliza a number[] un valor leido de una columna JSONB de Supabase, que
 * puede llegar como array o como string JSON.
 */
export function toNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.every(v => typeof v === 'number') ? (value as number[]) : [];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every(v => typeof v === 'number') ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function dispose(): void {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
  }
  loadingPromise = null;
  lastTimestampMs = 0;
}
