import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { compressStaticAssets } from './scripts/vite-plugin-compress-static.mjs';

/**
 * Dominios de tunel permitidos para el servidor de desarrollo.
 *
 * Por que hace falta: desde Vite 5.4.12 el dev server comprueba el header Host
 * y responde HTTP 403 "Blocked request. This host is not allowed" a cualquier
 * host que no reconozca (proteccion contra DNS rebinding). Al exponer el server
 * por un tunel, el Host es el dominio del tunel y no localhost, asi que Vite
 * bloquea TODAS las peticiones con 403 hasta que el dominio este en esta lista.
 *
 * El punto inicial autoriza el dominio y todos sus subdominios, que es lo que
 * necesitan los tuneles porque el subdominio cambia en cada arranque.
 * Se listan proveedores concretos en vez de `allowedHosts: true` para no quedar
 * expuesto a DNS rebinding desde cualquier dominio.
 *
 * localhost, *.localhost y cualquier IP quedan permitidos por Vite de serie:
 * no hace falta anadirlos.
 */
const TUNNEL_HOSTS = [
  '.trycloudflare.com',   // cloudflared tunnel --url http://localhost:5173
  '.ngrok-free.app',      // ngrok http 5173
  '.ngrok-free.dev',
  '.ngrok.app',
  '.ngrok.io',
  '.loca.lt',             // npx localtunnel --port 5173
  '.devtunnels.ms',       // reenvio de puertos de VS Code
  '.app.github.dev',      // GitHub Codespaces
  '.serveo.net',
  '.ts.net',              // Tailscale Funnel
];

export default defineConfig(({ mode }) => {
  // `npm run dev:tunnel` arranca en este modo. Solo carga .env y .env.local,
  // igual que el modo normal, asi que no cambia ninguna variable del proyecto.
  const isTunnel = mode === 'tunnel';

  return {
    // compressStaticAssets va primero: tiene que interceptar /wasm y /models
    // antes de que Vite los sirva sin comprimir.
    plugins: [compressStaticAssets(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      allowedHosts: TUNNEL_HOSTS,
      // Por el tunel la pagina se sirve en https y por el puerto 443, pero el
      // cliente de HMR intentaria conectarse a wss://<tunel>:5173 y fallaria.
      // Solo se aplica en modo tunel para no romper el desarrollo en localhost.
      ...(isTunnel ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
    },
    preview: {
      // `vite preview` tiene su propia comprobacion de host.
      allowedHosts: TUNNEL_HOSTS,
    },
  };
});
