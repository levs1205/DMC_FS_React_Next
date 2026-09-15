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

const isVercelProduction = process.env.VERCEL_ENV === "production";

/**
 * Dominios por los que se llega desde afuera. Hay tres orígenes posibles y
 * conviene tenerlos los tres, porque en Vercel el dominio cambia según el
 * entorno:
 *
 * - `MP_PUBLIC_BASE_URL`  → el túnel, en desarrollo.
 * - `NEXT_PUBLIC_SITE_URL` → el dominio propio, en producción.
 * - `VERCEL_URL`           → la URL que Vercel genera para CADA despliegue de
 *   preview (`mi-app-abc123-equipo.vercel.app`). Sin ella, las Server Actions
 *   fallan en los previews aunque funcionen en producción.
 */
const publicHosts = [
  hostOf(process.env.MP_PUBLIC_BASE_URL),
  hostOf(process.env.NEXT_PUBLIC_SITE_URL),
  process.env.VERCEL_URL?.trim() || null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || null,
].filter((host): host is string => Boolean(host));

const allowedOrigins = [
  ...new Set([...publicHosts, `localhost:${PORT}`, `127.0.0.1:${PORT}`]),
];

/**
 * Cabeceras de seguridad para todas las respuestas.
 *
 * Son baratas —una línea de configuración cada una— y cierran clases enteras de
 * ataque. Van aquí y no en el proxy porque así se aplican también a los assets
 * estáticos, que el proxy no toca.
 */
const securityHeaders = [
  /**
   * Impide que el navegador "adivine" el tipo de un archivo. Sin esto, un
   * archivo subido por un usuario y servido como texto puede acabar
   * ejecutándose como JavaScript si el navegador decide que eso parece.
   */
  { key: "X-Content-Type-Options", value: "nosniff" },

  /**
   * Nadie puede meter el sitio dentro de un iframe. Es la defensa contra el
   * clickjacking: una página atacante que superpone un botón invisible sobre
   * "Confirmar pago".
   */
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },

  /**
   * Al salir del sitio se manda solo el origen, nunca la ruta completa. Evita
   * filtrar URLs internas (`/intranet/reservas/91827/pago`) en el `Referer` de
   * cualquier enlace externo.
   */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  /**
   * La aplicación no usa cámara, micrófono ni geolocalización: se declara, y
   * así ningún script de terceros incrustado puede pedirlos.
   */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/**
 * HSTS solo en producción: obliga al navegador a usar HTTPS durante un año,
 * incluso si el usuario escribe `http://`. En desarrollo sería un estorbo —deja
 * el dominio "pegado" a HTTPS en el navegador y cuesta revertirlo—, por eso no
 * se envía fuera de producción.
 */
if (isVercelProduction) {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  // Deja que el servidor de desarrollo atienda los pedidos a `/_next/*` que
  // llegan por el túnel; sin esto la página carga sin estilos ni hidratación.
  allowedDevOrigins: allowedOrigins,

  experimental: {
    serverActions: { allowedOrigins },
  },

  /**
   * Quita la cabecera `X-Powered-By: Next.js`. No es seguridad de verdad
   * —nadie se salva por ocultar la tecnología— pero tampoco hay razón para
   * anunciar la versión del framework a quien busca exploits conocidos.
   */
  poweredByHeader: false,

  /**
   * `reactStrictMode` monta y desmonta cada componente dos veces en desarrollo
   * para sacar a la luz efectos mal limpiados. Molesta un poco y ahorra bugs
   * que solo aparecerían en producción.
   */
  reactStrictMode: true,

  /**
   * Los errores de tipo ROMPEN el build. Es el comportamiento por defecto y hay
   * que dejarlo así: se escribe explícito porque la tentación de poner
   * `ignoreBuildErrors: true` para desbloquear un despliegue urgente es real, y
   * es exactamente así como un `any` mal puesto llega a producción.
   *
   * ESLint ya NO corre dentro de `next build` (Next 16 quitó esa integración y
   * la opción `eslint` de este archivo). El lint es ahora un paso aparte:
   * `npm run lint`, y en CI antes de desplegar.
   */
  typescript: { ignoreBuildErrors: false },

  /**
   * Logs del servidor de desarrollo. El health check se consulta cada pocos
   * segundos y llenaría la terminal sin aportar nada.
   */
  logging: {
    fetches: { fullUrl: true },
    incomingRequests: { ignore: [/^\/api\/health$/, /^\/api\/metrics$/] },
  },

  async headers() {
    return [
      {
        // Todas las rutas.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
