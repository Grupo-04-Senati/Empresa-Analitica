import { stat, readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Comprime con gzip los archivos grandes de public/ en el servidor de
 * DESARROLLO.
 *
 * Por que hace falta: el dev server de Vite sirve public/ sin Content-Encoding,
 * y el escaner facial descarga ~14.8 MB antes de abrir la camara
 * (vision_wasm_internal.wasm 11.2 MB + face_landmarker.task 3.6 MB). En
 * localhost da igual, pero por un tunel es la diferencia entre 25 s y 11 s a
 * 5 Mbps: gzip los deja en 6.5 MB (56 % menos).
 *
 * En produccion no hace nada (apply: 'serve'): Vercel ya sirve estos archivos
 * comprimidos por su CDN y con Cache-Control immutable (ver vercel.json).
 *
 * El navegador descomprime de forma transparente, asi que
 * WebAssembly.instantiateStreaming sigue funcionando igual.
 */

/** Solo estas rutas: son los archivos grandes y no cambian al desarrollar. */
const PREFIXES = ['/wasm/', '/models/'];

const MIME = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
  '.task': 'application/octet-stream',
  '.tflite': 'application/octet-stream',
};

/** No merece la pena comprimir lo pequeno. */
const MIN_BYTES = 64 * 1024;

export function compressStaticAssets({ publicDir = 'public' } = {}) {
  /** Cache en memoria: comprimir 11 MB tarda ~1 s y no queremos repetirlo. */
  const cache = new Map();

  return {
    name: 'compress-static-assets',
    apply: 'serve',

    configureServer(server) {
      // Se registra antes del middleware de estaticos de Vite para poder
      // responder nosotros; si algo falla, delegamos con next().
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];

        if (!PREFIXES.some(p => url.startsWith(p))) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (!String(req.headers['accept-encoding'] || '').includes('gzip')) return next();

        const type = MIME[extname(url).toLowerCase()];
        if (!type) return next();

        // normalize + comprobacion de prefijo evita escapar de public/ con "..".
        const root = normalize(join(server.config.root, publicDir));
        const filePath = join(root, normalize(decodeURIComponent(url)).replace(/^[/\\]+/, ''));
        if (!filePath.startsWith(root)) return next();

        let info;
        try {
          info = await stat(filePath);
        } catch {
          return next();
        }
        if (!info.isFile() || info.size < MIN_BYTES) return next();

        const etag = `W/"gz-${info.size}-${Math.round(info.mtimeMs)}"`;

        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
          res.end();
          return;
        }

        try {
          let body = cache.get(etag);
          if (!body) {
            body = gzipSync(await readFile(filePath), { level: 6 });
            cache.clear();            // solo interesa la version vigente
            cache.set(etag, body);
            server.config.logger.info(
              `[compress] ${url}  ${(info.size / 1048576).toFixed(1)} MB -> ` +
              `${(body.length / 1048576).toFixed(1)} MB gzip`
            );
          }

          res.writeHead(200, {
            'Content-Type': type,
            'Content-Encoding': 'gzip',
            'Content-Length': body.length,
            'Cache-Control': 'no-cache',
            ETag: etag,
            Vary: 'Accept-Encoding',
          });
          res.end(req.method === 'HEAD' ? undefined : body);
        } catch (err) {
          // Ante cualquier problema, que lo sirva Vite sin comprimir.
          server.config.logger.warn(`[compress] ${url} sin comprimir: ${err.message}`);
          next();
        }
      });
    },
  };
}
