/**
 * Copia los binarios WASM de @mediapipe/tasks-vision a frontend/public/wasm.
 *
 * Por que: el paquete npm instalado y los binarios WASM DEBEN ser de la misma
 * version. Servirlos desde el CDN con una version distinta a la del paquete
 * rompe el FaceLandmarker (el glue JS espera simbolos que el .wasm no exporta).
 * Sirviendolos desde /wasm quedan siempre sincronizados, no dependemos del CDN
 * y el CSP 'self' los permite sin reglas extra.
 *
 * Se ejecuta automaticamente en `predev` y `prebuild`.
 * La carpeta public/wasm esta en .gitignore (~23 MB, se genera en cada build).
 */
import { createRequire } from 'node:module';
import { mkdir, copyFile, stat, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const destDir = resolve(here, '..', 'public', 'wasm');

/**
 * FilesetResolver.forVisionTasks(base) resuelve a:
 *   `${base}/vision_wasm_internal.js|.wasm`         (si el navegador soporta SIMD)
 *   `${base}/vision_wasm_nosimd_internal.js|.wasm`  (si no lo soporta)
 *
 * El paquete expone cada archivo como subpath export, asi que se resuelven por
 * nombre en lugar de asumir la ruta dentro de node_modules.
 */
const FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

async function packageVersion(anyResolvedFile) {
  // .../@mediapipe/tasks-vision/wasm/<file> -> .../@mediapipe/tasks-vision
  const pkgDir = resolve(dirname(anyResolvedFile), '..');
  try {
    const raw = await readFile(join(pkgDir, 'package.json'), 'utf8');
    return JSON.parse(raw).version ?? 'desconocida';
  } catch {
    return 'desconocida';
  }
}

async function main() {
  const sources = [];
  for (const file of FILES) {
    try {
      sources.push([file, require.resolve(`@mediapipe/tasks-vision/${file}`)]);
    } catch (err) {
      console.warn(`[mediapipe] no se pudo resolver ${file}: ${err.message}`);
    }
  }

  if (sources.length === 0) {
    console.warn(
      '[mediapipe] @mediapipe/tasks-vision no esta instalado; se omite la copia del WASM.\n' +
      '            El escaner facial usara el CDN como respaldo.'
    );
    return;
  }

  await mkdir(destDir, { recursive: true });

  let copied = 0;
  for (const [file, src] of sources) {
    const dest = join(destDir, file);
    try {
      const [srcStat, destStat] = await Promise.all([
        stat(src),
        stat(dest).catch(() => null),
      ]);
      // Salta la copia si el destino ya esta al dia (builds incrementales rapidos).
      if (destStat && destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
        continue;
      }
      await copyFile(src, dest);
      copied++;
    } catch (err) {
      console.warn(`[mediapipe] no se pudo copiar ${file}: ${err.message}`);
    }
  }

  const version = await packageVersion(sources[0][1]);
  console.log(
    `[mediapipe] WASM v${version} listo en public/wasm ` +
    `(${copied} archivo(s) copiado(s), ${sources.length - copied} ya al dia)`
  );
}

main().catch(err => {
  // Nunca rompemos el build por esto: el loader tiene respaldo por CDN.
  console.warn('[mediapipe] copia de WASM omitida:', err?.message || err);
});
