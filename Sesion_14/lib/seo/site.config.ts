/**
 * Datos "de marca" del sitio, en un único lugar.
 *
 * Todo lo que el SEO necesita repetir (título por defecto, descripción, URL
 * canónica, datos del negocio para el JSON-LD) vive acá: si mañana cambia el
 * dominio o el teléfono, se toca un archivo y no quince.
 *
 * La URL es la pieza más importante: `metadataBase`, el sitemap, el robots y
 * las etiquetas canónicas necesitan una URL ABSOLUTA. En local no existe, por
 * eso se lee de `NEXT_PUBLIC_SITE_URL` con fallback a localhost.
 */

const DEFAULT_SITE_URL = "http://localhost:3000";

// Sin barra final: después se concatena con rutas que ya empiezan con "/".
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * De dónde sale la URL pública del sitio, por orden de preferencia.
 *
 * El problema que resuelve el orden: en Vercel, **cada despliegue de preview
 * tiene una URL distinta** (`reservas-a1b2c3-test-dmc.vercel.app`). Poner un
 * valor fijo en la variable de Preview funciona exactamente una vez; en el
 * despliegue siguiente, el canonical, el sitemap y las `back_urls` de Mercado
 * Pago apuntan a un despliegue viejo. Por eso en preview la URL se lee de
 * `VERCEL_URL`, que Vercel rellena con la de cada despliegue.
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — la explícita. Gana siempre: es el dominio propio
 *    en producción y el túnel https en desarrollo.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` en producción — el dominio del proyecto.
 *    Es ESTABLE entre despliegues, que es justo lo que necesita un canonical.
 *    Deliberadamente NO se usa `VERCEL_URL` aquí: esa cambia en cada
 *    despliegue, y un canonical que cambia cada vez es un problema de SEO.
 * 3. `VERCEL_URL` en preview — la URL de este despliegue concreto.
 * 4. localhost.
 *
 * Las variables `VERCEL_*` son de servidor (no llevan prefijo `NEXT_PUBLIC_`),
 * y eso aquí no estorba: este archivo solo se usa desde el servidor —metadata,
 * sitemap, robots, JSON-LD y la configuración de Mercado Pago—. Si algún día se
 * importa desde un Client Component habrá que replantearlo.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (explicit) return explicit;

  const vercelHost = (
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL
  )?.trim();

  // `VERCEL_URL` viene sin protocolo ("mi-app.vercel.app"), y todo en Vercel
  // se sirve por https.
  if (vercelHost) return `https://${vercelHost}`;

  return DEFAULT_SITE_URL;
}

export const siteConfig = {
  url: normalizeUrl(resolveSiteUrl()),
  name: "Hotel DMC",
  title: "Hotel DMC — Reserva tu habitación en Lima",
  description:
    "Hotel boutique en Miraflores, Lima. Habitaciones individuales, dobles y suites con desayuno incluido y reserva online en minutos.",
  locale: "es_PE",
  // Datos del negocio: los usa el JSON-LD de la página del hotel.
  telephone: "+51 1 555 0100",
  email: "reservas@hoteldmc.pe",
  address: {
    street: "Av. Malecón de la Reserva 1035",
    city: "Miraflores",
    region: "Lima",
    postalCode: "15074",
    country: "PE",
  },
  geo: { latitude: -12.1301, longitude: -77.0305 },
  currency: "PEN",
  priceRange: "S/ 120 - S/ 750",
} as const;

/**
 * Convierte una ruta interna ("/habitaciones") en URL absoluta.
 * El JSON-LD y el sitemap SIEMPRE piden absolutas; `metadata` en cambio
 * resuelve las relativas solo gracias a `metadataBase`.
 */
export function absoluteUrl(path = "/"): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
