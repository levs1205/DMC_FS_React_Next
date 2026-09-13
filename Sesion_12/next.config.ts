import type { NextConfig } from "next";

/**
 * En desarrollo el sitio se publica por un túnel https (dev tunnels de VS
 * Code, ngrok) para que Mercado Pago pueda alcanzar el webhook y las
 * `back_urls`. Ese túnel es un proxy, y eso rompe dos controles de Next que
 * comparan el origen del pedido contra el host del servidor.
 *
 * Esto es lo que llega de verdad al servidor detrás del túnel de VS Code:
 *
 *   host:             localhost:3000
 *   origin:           http://localhost:3000        <-- REESCRITO por el túnel
 *   x-forwarded-host: xxxx-3000.brs.devtunnels.ms
 *
 * O sea: el túnel NO conserva el origen del navegador, lo reemplaza por el
 * host local, y deja el dominio público solo en `x-forwarded-host`. Next
 * compara `origin` contra `x-forwarded-host`, ve que no coinciden y aborta
 * toda Server Action con "Invalid Server Actions request" (era exactamente el
 * 500 del botón de pagar). Otros túneles —ngrok, por ejemplo— sí conservan el
 * origen original, y entonces el que no coincide es el otro.
 *
 * Por eso se permiten los dos: el dominio público y el loopback. Permitir
 * `localhost` no debilita la protección CSRF: el navegador es quien fija el
 * header `Origin`, así que una página atacante jamás puede presentarse como
 * `http://localhost:3000`; para lograrlo habría que estar sirviendo desde la
 * máquina de la víctima, y con ese nivel de acceso el CSRF sobra.
 */
function hostOf(rawUrl: string | undefined): string | null {
  const value = rawUrl?.trim();

  if (!value) return null;

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

const PORT = process.env.PORT?.trim() || "3000";

// Dominio por el que se llega desde afuera: el túnel en desarrollo, el
// dominio real en producción.
const publicHost = hostOf(process.env.MP_PUBLIC_BASE_URL);

const allowedOrigins = [
  ...(publicHost ? [publicHost] : []),
  `localhost:${PORT}`,
  `127.0.0.1:${PORT}`,
];

const nextConfig: NextConfig = {
  // Deja que el servidor de desarrollo atienda los pedidos a `/_next/*` que
  // llegan por el túnel; sin esto la página carga sin estilos ni hidratación.
  allowedDevOrigins: allowedOrigins,
  experimental: {
    serverActions: { allowedOrigins },
  },
};

export default nextConfig;
