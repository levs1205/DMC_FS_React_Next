import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo/site.config";
import { listRooms } from "@/modules/rooms/room.service";

/**
 * app/sitemap.ts -> se sirve en /sitemap.xml
 *
 * El sitemap es la lista de las URLs que SÍ queremos que el buscador indexe.
 * No garantiza indexación, pero es la forma de contarle a Google las páginas
 * que existen sin depender de que las descubra navegando enlace por enlace
 * (clave para el detalle de cada habitación).
 *
 * Reglas que se aplican acá:
 * - Solo rutas PÚBLICAS. /backoffice, /intranet y /login quedan afuera:
 *   pedir que se indexe algo que responde con redirección al login es basura
 *   para el crawler (y para el informe de Search Console).
 * - URLs absolutas y canónicas (mismo slug que declara la etiqueta canonical).
 * - `priority` es relativo dentro del propio sitio: no compite con otros.
 *
 * Es un Route Handler especial: se genera en el build y queda cacheado,
 * salvo que use APIs de request.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rooms = await listRooms();
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteConfig.url}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/habitaciones`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/hotel`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // Una entrada por habitación, generada desde la misma fuente que las
  // páginas: si se agrega una habitación a la base, aparece sola en el
  // sitemap. Un sitemap escrito a mano se desactualiza en la primera semana.
  const roomRoutes: MetadataRoute.Sitemap = rooms.map((room) => ({
    url: `${siteConfig.url}/habitaciones/${room.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...roomRoutes];
}
