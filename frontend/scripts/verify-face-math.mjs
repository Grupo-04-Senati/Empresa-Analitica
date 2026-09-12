/**
 * Verifica, sin camara ni navegador, la matematica del reconocimiento facial
 * de src/services/mediaPipeFace.ts.
 *
 * Comprueba lo que no se puede ver a ojo en el escaner:
 *   - que la normalizacion sea invariante a posicion, escala, aspecto del video
 *     e inclinacion de la cabeza (el fallo que hacia que el login nunca
 *     reconociera a nadie);
 *   - que la misma cara de dos sesiones distintas supere el umbral y que dos
 *     caras distintas no lo superen;
 *   - que la plantilla temporal descarte frames malos y exija un minimo.
 *
 * Uso:  npm run test:face      (desde frontend/)
 */
import * as esbuild from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '..', 'src', 'services', 'mediaPipeFace.ts');

/**
 * @mediapipe/tasks-vision solo se usa en tiempo de ejecucion en el navegador;
 * para estos tests se sustituye por un stub.
 */
const stubMediaPipe = {
  name: 'stub-mediapipe',
  setup(build) {
    build.onResolve({ filter: /^@mediapipe\/tasks-vision$/ }, () => ({
      path: 'stub-mediapipe',
      namespace: 'stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'export class FaceLandmarker {}\nexport class FilesetResolver {}\n',
      loader: 'js',
    }));
  },
};

const bundle = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
  plugins: [stubMediaPipe],
  logLevel: 'warning',
});

const code = bundle.outputFiles[0].text;
const F = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

// ---------------------------------------------------------------------------

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

/** PRNG determinista para que los tests sean reproducibles. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const EYE_L = 33;
const EYE_R = 263;

const NOSE = 1, CHEEK_L = 234, CHEEK_R = 454;

/**
 * Cara "canonica" sintetica: esquinas de los ojos en (-0.5,0,0) y (0.5,0,0),
 * que es exactamente la convencion a la que normaliza normalizeLandmarks478,
 * asi que normalizar una proyeccion debe devolver esta misma forma.
 *
 * La nariz sobresale en +z y los pomulos se hunden en -z, para que al girar la
 * cabeza la proyeccion se comprima como en un rostro real.
 */
function canonicalFace(seed) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 478; i++) {
    pts.push({ x: (r() - 0.5) * 2.4, y: (r() - 0.5) * 3.0, z: (r() - 0.5) * 0.8 });
  }
  pts[EYE_L] = { x: -0.5, y: 0, z: 0 };
  pts[EYE_R] = { x: 0.5, y: 0, z: 0 };
  pts[NOSE] = { x: 0, y: 0.40, z: 0.60 };
  pts[CHEEK_L] = { x: -0.90, y: 0.15, z: -0.50 };
  pts[CHEEK_R] = { x: 0.90, y: 0.15, z: -0.50 };
  return pts;
}

/** Gira la cara sobre el eje vertical (yaw), como al mirar de lado. */
function yawFace(face, degrees) {
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return face.map(p => ({
    x: p.x * cos + p.z * sin,
    y: p.y,
    z: -p.x * sin + p.z * cos,
  }));
}

/** Proyecta una cara canonica a coordenadas como las que entrega MediaPipe. */
function project(face, v) {
  const cos = Math.cos(v.roll);
  const sin = Math.sin(v.roll);
  return face.map(p => {
    const X = p.x * cos - p.y * sin;
    const Y = p.x * sin + p.y * cos;
    return {
      x: X * v.scale + v.tx,
      y: (Y * v.scale + v.ty) / v.aspect, // y de MediaPipe se normaliza al ALTO
      z: p.z * v.scale + v.tz,
    };
  });
}

function maxDiff(a, b) {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    m = Math.max(m,
      Math.abs(a[i].x - b[i].x),
      Math.abs(a[i].y - b[i].y),
      Math.abs(a[i].z - b[i].z));
  }
  return m;
}

/**
 * Construye un frame igual que lo hace detectFrame: proyecta, mete ruido,
 * normaliza y de ahi deriva el giro y la pose.
 */
function makeFrame(face, v, noise, r, timestamp) {
  const landmarks = project(face, v).map(p => ({
    x: p.x + (r() - 0.5) * noise,
    y: p.y + (r() - 0.5) * noise,
    z: p.z + (r() - 0.5) * noise,
  }));
  const normalized = F.normalizeLandmarks478(landmarks, v.aspect);
  const yawRatio = F.yawRatioOf(normalized);
  return {
    landmarks,
    normalized,
    blendshapes: [{ name: 'eyeBlinkLeft', score: r() * 0.2 }],
    faceWidth: 0.3,
    faceHeight: 0.4,
    aspect: v.aspect,
    frontality: 0.9,
    rollDegrees: (v.roll * 180) / Math.PI,
    yawRatio,
    pose: F.classifyPose(yawRatio),
    confidence: 0.9,
    timestamp,
  };
}

function jitterView(r) {
  return {
    roll: (r() - 0.5) * 0.12,
    scale: 0.28 + (r() - 0.5) * 0.04,
    tx: 0.5 + (r() - 0.5) * 0.03,
    ty: 0.5 + (r() - 0.5) * 0.03,
    tz: 0,
    aspect: 480 / 640,
  };
}

/** Simula un escaneo frontal: N frames con temblor de camara y ruido. */
function scanFrames(face, count, noise, seed) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(makeFrame(face, jitterView(r), noise, r, i * 80));
  }
  return out;
}

/** Simula el barrido del registro: de un lado al otro pasando por el centro. */
function sweepFrames(face, count, noise, seed, maxDegrees = 26) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    // Barrido triangular: -max -> +max -> -max
    const phase = (i / (count - 1)) * 2;
    const t = phase <= 1 ? phase * 2 - 1 : 3 - phase * 2;
    out.push(makeFrame(yawFace(face, t * maxDegrees), jitterView(r), noise, r, i * 80));
  }
  return out;
}

function templateSignature(face, noise, seed) {
  const t = F.buildTemporalSignature(scanFrames(face, 25, noise, seed));
  return t ? F.generateFaceSignature478(t.avgLandmarks) : null;
}

console.log('\nNormalizacion');
const face = canonicalFace(7);
const aspect = 480 / 640;
const normA = F.normalizeLandmarks478(
  project(face, { roll: 0, scale: 0.3, tx: 0.5, ty: 0.45, tz: 0, aspect }), aspect
);
check('recupera la forma canonica', maxDiff(normA, face) < 1e-9,
  `error max ${maxDiff(normA, face).toExponential(2)}`);

let worst = 0;
for (const v of [
  { roll: 0.25, scale: 0.18, tx: 0.35, ty: 0.30, tz: -0.05, aspect: 480 / 640 },
  { roll: -0.30, scale: 0.42, tx: 0.62, ty: 0.58, tz: 0.11, aspect: 720 / 1280 },
  { roll: 0.05, scale: 0.25, tx: 0.50, ty: 0.50, tz: 0.00, aspect: 1 },
  { roll: -0.15, scale: 0.33, tx: 0.44, ty: 0.52, tz: 0.07, aspect: 1280 / 720 },
]) {
  worst = Math.max(worst, maxDiff(F.normalizeLandmarks478(project(face, v), v.aspect), face));
}
check('invariante a inclinacion, escala, posicion y aspecto', worst < 1e-9,
  `error max ${worst.toExponential(2)}`);

console.log('\nFirma facial');
const sig1 = templateSignature(face, 0.002, 3);
check('longitud de firma correcta', sig1.length === F.SIGNATURE_LENGTH,
  `${sig1.length} valores`);
check('flat array de la malla completa tiene 1434 valores',
  F.landmarksToFlatArray(normA).length === 1434);
check('serializacion ida y vuelta conserva la malla',
  maxDiff(F.flatArrayToLandmarks(F.landmarksToFlatArray(normA)), normA) <= 1e-4);

console.log('\nLogin facial');
const other = canonicalFace(99);
const simSame = F.rmsToSimilarity(F.signatureDistance(sig1, templateSignature(face, 0.002, 77)));
const simOther = F.rmsToSimilarity(F.signatureDistance(sig1, templateSignature(other, 0.002, 55)));
check('misma persona, otra sesion -> reconocida', simSame >= F.MATCH_THRESHOLD,
  `similitud ${simSame} (umbral ${F.MATCH_THRESHOLD})`);
check('persona distinta -> rechazada', simOther < F.MATCH_THRESHOLD,
  `similitud ${simOther}`);
check('margen 1:N suficiente', simSame - simOther >= F.MATCH_MIN_MARGIN,
  `margen ${(simSame - simOther).toFixed(3)} (min ${F.MATCH_MIN_MARGIN})`);
check('firmas de distinta longitud no comparan',
  !Number.isFinite(F.signatureDistance([1, 2, 3], [1, 2])));

console.log('\nPlantilla temporal');
const temporal = F.buildTemporalSignature(scanFrames(face, 25, 0.002, 3));
check('devuelve plantilla con suficientes frames', !!temporal);
check('estabilidad alta en captura quieta', temporal.stability > 0.5,
  `estabilidad ${temporal.stability}`);
check('exige un minimo de frames', F.buildTemporalSignature(scanFrames(face, 3, 0.002, 9)) === null);
check('sin frames devuelve null', F.buildTemporalSignature([]) === null);

console.log('\nLectura de columnas JSONB de Supabase');
check('array', F.toNumberArray([1, 2, 3]).length === 3);
check('string JSON', F.toNumberArray('[1,2,3]').length === 3);
check('valor invalido', F.toNumberArray('no-json').length === 0);
check('null', F.toNumberArray(null).length === 0);

console.log('\nMedidas 3D del rostro (lejos vs cerca de la camara)');
{
  // `scale` simula la distancia a la camara: 0.15 = lejos, 0.55 = muy cerca.
  const medirA = escala => F.computeFaceMetrics3D(
    F.normalizeLandmarks478(
      project(face, { roll: 0, scale: escala, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
    )
  );

  const lejos = medirA(0.15);
  const medio = medirA(0.30);
  const cerca = medirA(0.55);

  check('devuelve todas las medidas',
    lejos && Object.keys(lejos).length === Object.keys(F.METRIC_LABELS).length,
    `${Object.keys(lejos).length} medidas`);

  const difLejosCerca = F.compareFaceMetrics3D(lejos, cerca);
  const peor = Object.entries(difLejosCerca).sort((a, b) => b[1] - a[1])[0];
  check('las medidas NO cambian con la distancia a la camara',
    peor[1] < 1e-9,
    `mayor diferencia: ${peor[0]} ${(peor[1] * 100).toFixed(6)} %`);

  const difMedio = F.compareFaceMetrics3D(lejos, medio);
  check('tampoco a distancia intermedia',
    Object.values(difMedio).every(v => v < 1e-9));

  console.log('        medidas del rostro sintetico (unidades interoculares):');
  for (const [clave, valor] of Object.entries(medio)) {
    console.log(`          ${F.METRIC_LABELS[clave].padEnd(24)} ${valor}`);
  }

  // Otra persona tiene medidas distintas: es lo que las hace utiles.
  const medidasOtro = F.computeFaceMetrics3D(
    F.normalizeLandmarks478(
      project(other, { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
    )
  );
  const difPersonas = F.compareFaceMetrics3D(medio, medidasOtro);
  const cambian = Object.values(difPersonas).filter(v => v > 0.05).length;
  check('otra persona da medidas distintas',
    cambian >= Object.keys(difPersonas).length / 2,
    `${cambian} de ${Object.keys(difPersonas).length} medidas difieren mas del 5 %`);

  check('malla incompleta -> null', F.computeFaceMetrics3D([{ x: 0, y: 0, z: 0 }]) === null);

  /*
   * Pomulos marcados por delgadez: el arco cigomatico sobresale en z y la
   * mejilla de debajo se hunde. Es relieve, no anchura, asi que hay que
   * comprobar que relievePomulos y huecoMejillas lo recogen.
   */
  const ARCO = [118, 119, 120, 347, 348, 349];
  const HUECO = [205, 425];

  const conRelieve = (saliente, hundido) => {
    const cara = face.map((p, i) => {
      if (ARCO.includes(i)) return { ...p, z: p.z + saliente };
      if (HUECO.includes(i)) return { ...p, z: p.z - hundido };
      return p;
    });
    return F.computeFaceMetrics3D(
      F.normalizeLandmarks478(
        project(cara, { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
      )
    );
  };

  const delgado = conRelieve(0.35, 0.30);   // pomulos marcados, mejilla hundida
  const relleno = conRelieve(0.05, 0.02);   // rostro mas lleno

  check('pomulos marcados dan mas relieve que un rostro lleno',
    delgado.relievePomulos > relleno.relievePomulos,
    `delgado ${delgado.relievePomulos} vs lleno ${relleno.relievePomulos}`);
  check('la mejilla hundida se mide distinta',
    delgado.huecoMejillas > relleno.huecoMejillas,
    `delgado ${delgado.huecoMejillas} vs lleno ${relleno.huecoMejillas}`);

  const difComplexion = F.compareFaceMetrics3D(delgado, relleno);
  check('el relieve distingue complexiones de forma apreciable',
    difComplexion.relievePomulos > 0.2 || difComplexion.huecoMejillas > 0.2,
    `relieve ${(difComplexion.relievePomulos * 100).toFixed(0)} %, hueco ${(difComplexion.huecoMejillas * 100).toFixed(0)} %`);

  // Y sigue sin depender de la distancia a la camara.
  const delgadoLejos = F.computeFaceMetrics3D(
    F.normalizeLandmarks478(
      project(face.map((p, i) => ARCO.includes(i) ? { ...p, z: p.z + 0.35 } : p),
        { roll: 0, scale: 0.15, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
    )
  );
  const delgadoCerca = F.computeFaceMetrics3D(
    F.normalizeLandmarks478(
      project(face.map((p, i) => ARCO.includes(i) ? { ...p, z: p.z + 0.35 } : p),
        { roll: 0, scale: 0.55, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
    )
  );
  check('el relieve de pomulos tampoco cambia con la distancia',
    Math.abs(delgadoLejos.relievePomulos - delgadoCerca.relievePomulos) < 1e-9,
    `${delgadoLejos.relievePomulos} a 0.15 y ${delgadoCerca.relievePomulos} a 0.55`);

  // La firma tiene que notar el cambio: la region de pomulos debe bajar.
  const sigDelgado = F.generateFaceSignature478(F.normalizeLandmarks478(
    project(face.map((p, i) => {
      if (ARCO.includes(i)) return { ...p, z: p.z + 0.35 };
      if (HUECO.includes(i)) return { ...p, z: p.z - 0.30 };
      return p;
    }), { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect));
  const sigNormal = F.generateFaceSignature478(F.normalizeLandmarks478(
    project(face, { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect));
  const porRegion = F.compareSignaturesByRegion(sigNormal, sigDelgado);
  check('la region de pomulos de la firma refleja el cambio de relieve',
    porRegion.perRegion.pomulos < 0.99,
    `pomulos ${porRegion.perRegion.pomulos.toFixed(3)}, nariz ${porRegion.perRegion.nariz.toFixed(3)} (sin tocar)`);
}

console.log('\nAlineacion de la malla sobre el video (object-cover)');
{
  // Medidas reales del recuadro del escaner en el movil del usuario.
  const BOX_W = 656, BOX_H = 490;          // recuadro 4:3
  const map = (vw, vh) => F.coverMapping(vw, vh, BOX_W, BOX_H);
  const px = (m, x) => x * m.drawnW + m.offsetX;
  const py = (m, y) => y * m.drawnH + m.offsetY;

  // Camara vertical de movil dentro de un recuadro horizontal.
  const movil = map(480, 640);
  check('movil vertical: el video llena el ancho',
    Math.abs(movil.drawnW - BOX_W) < 0.01, `drawnW ${movil.drawnW.toFixed(1)}`);
  check('movil vertical: se recorta arriba y abajo por igual',
    movil.offsetY < 0 && Math.abs(movil.offsetX) < 0.01,
    `offsetY ${movil.offsetY.toFixed(1)}px`);
  check('el centro del frame cae en el centro del recuadro',
    Math.abs(px(movil, 0.5) - BOX_W / 2) < 0.01 && Math.abs(py(movil, 0.5) - BOX_H / 2) < 0.01);

  // Con el mapeo antiguo (y * altoDelRecuadro) el error era grande: es lo que
  // hacia que la malla apareciese comprimida en una banda en medio de la cara.
  const yFrente = 0.28;
  const correcto = py(movil, yFrente);
  const antiguo = yFrente * BOX_H;
  check('el mapeo antiguo desplazaba los puntos de forma apreciable',
    Math.abs(antiguo - correcto) > 50,
    `en y=${yFrente}: antiguo ${antiguo.toFixed(0)}px vs correcto ${correcto.toFixed(0)}px`);

  // Proporcion identica a la del recuadro: no se recorta nada en absoluto.
  const exacto = F.coverMapping(640, 480, 640, 480);
  check('misma proporcion que el recuadro: recorte cero',
    Math.abs(exacto.offsetX) < 1e-9 && Math.abs(exacto.offsetY) < 1e-9);

  // Webcam 4:3 en el recuadro real (656x490, que no es 4:3 exacto): el recorte
  // es de ~1px, imperceptible. Por eso el fallo no se veia en el PC y si en el
  // movil, donde el mismo error vale ~84px.
  const webcam = map(640, 480);
  const errorPC = Math.abs(0.28 * BOX_H - py(webcam, 0.28));
  check('webcam 4:3: el recorte es despreciable (por eso en PC no se notaba)',
    Math.abs(webcam.offsetY) < 2 && errorPC < 3,
    `recorte ${Math.abs(webcam.offsetY).toFixed(1)}px, error del mapeo antiguo ${errorPC.toFixed(1)}px`);

  // Camara horizontal 16:9: se recorta a los lados.
  const ancha = map(1280, 720);
  check('camara 16:9: se recorta a los lados',
    ancha.offsetX < 0 && Math.abs(ancha.drawnH - BOX_H) < 0.01,
    `offsetX ${ancha.offsetX.toFixed(1)}px`);

  check('video sin dimensiones aun: no revienta',
    map(0, 0).drawnW === BOX_W && map(0, 0).offsetX === 0);

  /*
   * El escaner usa containMapping con un recuadro que adopta la proporcion de
   * la camara. Cuando coinciden, contain y cover dan lo mismo: ni bandas ni
   * recorte. Es lo que hace que la malla encaje en cualquier camara.
   */
  const vertical = F.containMapping(480, 640, 360, 480);   // recuadro 3:4
  check('recuadro con la proporcion de la camara: sin bandas ni recorte',
    Math.abs(vertical.offsetX) < 1e-9 && Math.abs(vertical.offsetY) < 1e-9 &&
    Math.abs(vertical.drawnW - 360) < 1e-9 && Math.abs(vertical.drawnH - 480) < 1e-9);

  const cover480 = F.coverMapping(480, 640, 360, 480);
  check('con proporciones iguales, contain y cover coinciden',
    Math.abs(cover480.drawnH - vertical.drawnH) < 1e-9);

  // Si el recuadro no cuadra (tope de alto en pantallas bajas), contain deja
  // bandas pero NO desalinea: el mapeo sigue siendo exacto.
  const conBandas = F.containMapping(480, 640, 400, 300);
  check('contain con recuadro discordante: deja bandas, no recorta',
    conBandas.drawnH <= 300 + 1e-9 && conBandas.offsetX > 0,
    `dibujado ${conBandas.drawnW.toFixed(0)}x${conBandas.drawnH.toFixed(0)}, banda lateral ${conBandas.offsetX.toFixed(0)}px`);
  check('contain: el centro del frame sigue en el centro del recuadro',
    Math.abs((0.5 * conBandas.drawnW + conBandas.offsetX) - 200) < 1e-9 &&
    Math.abs((0.5 * conBandas.drawnH + conBandas.offsetY) - 150) < 1e-9);
}

console.log('\nGiro de cabeza (yaw)');
const frontalNorm = F.normalizeLandmarks478(
  project(face, { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
);
check('de frente -> yaw ~0 y pose frontal',
  Math.abs(F.yawRatioOf(frontalNorm)) < 0.01 && F.classifyPose(F.yawRatioOf(frontalNorm)) === 'frontal',
  `yaw ${F.yawRatioOf(frontalNorm).toFixed(4)}`);

let monotono = true;
let previo = -Infinity;
const tabla = [];
for (const deg of [-30, -20, -14, -8, -4, 0, 4, 8, 14, 20, 30]) {
  const n = F.normalizeLandmarks478(
    project(yawFace(face, deg), { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
  );
  const yaw = F.yawRatioOf(n);
  if (yaw <= previo) monotono = false;
  previo = yaw;
  tabla.push(`${String(deg).padStart(3)}deg -> ${yaw.toFixed(3)} ${F.classifyPose(yaw) ?? 'transicion'}`);
}
check('yaw crece de forma monotona con el giro', monotono);
for (const linea of tabla) console.log(`        ${linea}`);

const izq = F.normalizeLandmarks478(
  project(yawFace(face, -26), { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
);
const der = F.normalizeLandmarks478(
  project(yawFace(face, 26), { roll: 0, scale: 0.3, tx: 0.5, ty: 0.5, tz: 0, aspect }), aspect
);
check('cada lado se clasifica distinto',
  F.classifyPose(F.yawRatioOf(izq)) === 'izquierda' && F.classifyPose(F.yawRatioOf(der)) === 'derecha',
  `${F.classifyPose(F.yawRatioOf(izq))} / ${F.classifyPose(F.yawRatioOf(der))}`);

console.log('\nRegistro por barrido (izquierda -> frontal -> derecha)');
const sweep = F.buildPoseTemplates(sweepFrames(face, 60, 0.002, 11));
check('captura las tres poses',
  !!sweep.templates.izquierda && !!sweep.templates.frontal && !!sweep.templates.derecha,
  `frames por pose: izq ${sweep.frameCounts.izquierda}, frontal ${sweep.frameCounts.frontal}, der ${sweep.frameCounts.derecha}`);
check('las plantillas laterales son distintas de la frontal',
  F.signatureDistance(sweep.templates.izquierda.signature, sweep.templates.frontal.signature) > 0.02,
  `rms izq-frontal ${F.signatureDistance(sweep.templates.izquierda.signature, sweep.templates.frontal.signature).toFixed(3)}`);

console.log('\nLogin contra plantillas multi-pose');
const sweepMismo = F.buildPoseTemplates(sweepFrames(face, 60, 0.002, 91));
const mSame = F.comparePoseSets(sweep.templates, sweepMismo.templates);
check('misma persona -> reconocida en las tres poses',
  mSame.similarity >= F.MATCH_THRESHOLD && mSame.posesCompared.length === 3,
  `similitud ${mSame.similarity}, poses ${mSame.posesCompared.join('+')}`);

const sweepOtro = F.buildPoseTemplates(sweepFrames(other, 60, 0.002, 33));
const mOther = F.comparePoseSets(sweep.templates, sweepOtro.templates);
check('persona distinta -> rechazada', mOther.similarity < F.MATCH_THRESHOLD,
  `similitud ${mOther.similarity}`);

// Login frontal corto contra un registro completo: debe emparejar solo frontal.
const loginFrontal = F.buildPoseTemplates(scanFrames(face, 25, 0.002, 44));
const mFrontal = F.comparePoseSets(loginFrontal.templates, sweep.templates);
check('login solo frontal empareja la pose frontal',
  mFrontal.posesCompared.length === 1 && mFrontal.posesCompared[0] === 'frontal',
  `poses ${mFrontal.posesCompared.join('+') || 'ninguna'}`);
check('login solo frontal reconoce a la persona', mFrontal.similarity >= F.MATCH_THRESHOLD,
  `similitud ${mFrontal.similarity}`);

const mFrontalOtro = F.comparePoseSets(
  F.buildPoseTemplates(scanFrames(other, 25, 0.002, 66)).templates, sweep.templates
);
check('login solo frontal rechaza a otra persona',
  mFrontalOtro.similarity < F.MATCH_THRESHOLD, `similitud ${mFrontalOtro.similarity}`);

check('sin poses en comun -> similitud 0',
  F.comparePoseSets({ izquierda: sweep.templates.izquierda }, { derecha: sweep.templates.derecha }).similarity === 0);

console.log('\nComparacion por regiones (cada zona del rostro por separado)');
{
  const sigA = sweep.templates.frontal.signature;

  const iguales = F.compareSignaturesByRegion(sigA, sigA);
  check('firma consigo misma: todas las regiones al 100%',
    iguales.overall === 1 && iguales.weakestScore === 1,
    `regiones: ${F.FACE_REGIONS.join(', ')}`);

  const otroSig = sweepOtro.templates.frontal.signature;
  const distintas = F.compareSignaturesByRegion(sigA, otroSig);
  check('persona distinta: ninguna region coincide',
    distintas.overall < F.MATCH_THRESHOLD && distintas.weakestScore < F.REGION_FLOOR,
    `overall ${distintas.overall}, peor region ${distintas.weakestRegion} ${distintas.weakestScore.toFixed(3)}`);

  check('longitudes distintas -> null',
    F.compareSignaturesByRegion(sigA, [1, 2, 3]) === null);

  /*
   * IMPOSTOR PARCIAL: nariz, ojos, labios, cejas identicos; mandibula y
   * pomulos distintos. Es el caso que un promedio global deja pasar, porque
   * 5 de 7 zonas coinciden al 100% y arrastran la media.
   *
   * No se toca 234 ni 454 (los pomulos que usa el calculo de giro) para que la
   * pose siga clasificandose igual y la comparacion sea de pose contra pose.
   */
  const MANDIBULA = [58, 93, 132, 136, 148, 149, 150, 152, 172, 176, 288, 323,
                     356, 361, 365, 378, 379, 389, 397, 400];
  const POMULOS = [50, 101, 118, 119, 120, 123, 147, 187, 205, 280, 330, 348,
                   349, 350, 352, 376, 411, 425];
  const alterar = new Set([...MANDIBULA, ...POMULOS]);

  const r = rng(4242);
  const impostor = face.map((p, i) => alterar.has(i)
    ? { x: p.x + (r() - 0.5) * 0.55, y: p.y + (r() - 0.5) * 0.55, z: p.z + (r() - 0.5) * 0.55 }
    : p);

  const impostorSig = F.buildPoseTemplates(sweepFrames(impostor, 60, 0.002, 21))
    .templates.frontal.signature;
  const parcial = F.compareSignaturesByRegion(sigA, impostorSig);

  console.log('        similitud por region frente al impostor parcial:');
  for (const reg of F.FACE_REGIONS) {
    const s = parcial.perRegion[reg];
    console.log(`          ${reg.padEnd(10)} ${s.toFixed(3)} ${s < F.REGION_FLOOR ? '<- por debajo del minimo' : ''}`);
  }

  // Como lo habria juzgado la metrica global (una sola distancia para todo).
  const global = F.rmsToSimilarity(F.signatureDistance(sigA, impostorSig));
  console.log(`        metrica global: ${global.toFixed(3)}  |  media por regiones: ${parcial.overall.toFixed(3)}`);

  check('impostor parcial: la zona que no cuadra queda por debajo del minimo',
    parcial.weakestScore < F.REGION_FLOOR,
    `peor region ${parcial.weakestRegion} = ${parcial.weakestScore.toFixed(3)} (minimo ${F.REGION_FLOOR})`);

  check('impostor parcial: las zonas que si coinciden siguen al 100%',
    parcial.perRegion.nariz > 0.99 && parcial.perRegion.ojoIzq > 0.99,
    `nariz ${parcial.perRegion.nariz.toFixed(3)}, ojoIzq ${parcial.perRegion.ojoIzq.toFixed(3)}`);

  // La comprobacion que de verdad lo bloquea en el login.
  const pasaUmbral = parcial.overall >= F.MATCH_THRESHOLD;
  const pasaRegiones = parcial.weakestScore >= F.REGION_FLOOR;
  check('impostor parcial: RECHAZADO por la regla de regiones', !pasaRegiones,
    pasaUmbral
      ? 'el promedio lo habria aceptado; la regla de regiones lo frena'
      : 'lo rechazan tanto el promedio como las regiones');
}

console.log('\nLectura de filas de la tabla rostros');
const fila = {
  embedding_frontal: sweep.templates.frontal.signature,
  embedding_izquierda: JSON.stringify(sweep.templates.izquierda.signature),
  embedding_derecha: sweep.templates.derecha.signature,
};
const desdeFila = F.poseSetFromRow(fila);
check('reconstruye las tres poses desde la fila',
  !!desdeFila.frontal && !!desdeFila.izquierda && !!desdeFila.derecha);
check('la fila reconstruida coincide consigo misma',
  F.comparePoseSets(desdeFila, sweep.templates).similarity === 1);
check('fila vacia -> ninguna pose',
  Object.keys(F.poseSetFromRow({ embedding_frontal: null })).length === 0);
check('firma de version antigua (otra longitud) se ignora',
  Object.keys(F.poseSetFromRow({ embedding_frontal: [1, 2, 3] })).length === 0);

console.log('\nTolerancia al ruido de deteccion (misma persona)');
for (const noise of [0.002, 0.01, 0.02, 0.04]) {
  const s = F.rmsToSimilarity(
    F.signatureDistance(templateSignature(face, noise, 3), templateSignature(face, noise, 77))
  );
  console.log(`        ruido ${String(noise).padEnd(6)} -> similitud ${String(s).padEnd(6)} ${s >= F.MATCH_THRESHOLD ? 'acepta' : 'RECHAZA'}`);
}

console.log(
  failures === 0
    ? '\nTODO CORRECTO: la matematica del escaner facial funciona.\n'
    : `\n${failures} VERIFICACION(ES) FALLARON\n`
);
process.exit(failures === 0 ? 0 : 1);
