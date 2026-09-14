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

export const siteConfig = {
  url: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL),
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
