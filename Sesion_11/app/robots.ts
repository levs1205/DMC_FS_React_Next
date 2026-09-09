import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo/site.config";

/**
 * app/robots.ts -> se sirve en /robots.txt
 *
 * Le dice al crawler por dónde puede pasar. Dos ideas que conviene tener
 * claras porque se confunden todo el tiempo:
 *
 * 1. `Disallow` NO es seguridad. Es una sugerencia que los buscadores serios
 *    respetan; un atacante lo ignora. La protección real de /backoffice y
 *    /intranet la hacen `proxy.ts` y `requireRole` en los layouts.
 * 2. `Disallow` NO es lo mismo que `noindex`. Si se bloquea una ruta acá, el
 *    robot no la visita y por lo tanto NUNCA lee su etiqueta noindex; puede
 *    seguir mostrando la URL si otro sitio la enlaza. Por eso las zonas
 *    privadas llevan además `robots: { index: false }` en su metadata.
 *
 * El sitemap se declara al final: es la puerta de entrada del crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/backoffice", "/intranet", "/login"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
