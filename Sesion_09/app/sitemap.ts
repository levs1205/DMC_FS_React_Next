import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo/site.config";
import { listRooms } from "@/modules/rooms/room.service";


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