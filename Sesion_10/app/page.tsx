/**
 * Ruta: "/" (portada pública)
 *
 * Server Component: el HTML sale ya armado desde el servidor, que es la
 * condición para que un buscador lo lea. Si esta página fuera un Client
 * Component con los datos cargados por `useEffect`, el crawler recibiría un
 * <div> vacío.
 *
 * Ejemplo de SEO nº 1: metadata estática + JSON-LD del sitio.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/seo/site.config";

/**
 * Metadata estática: se exporta un objeto `Metadata` y Next arma las
 * etiquetas del <head>. Se usa cuando el contenido no depende de datos
 * (para lo dinámico está `generateMetadata`, ver /habitaciones/[slug]).
 */
export const metadata: Metadata = {
  // `title.absolute` ignora el template del layout: la portada no debería
  // titularse "Hotel DMC | Hotel DMC".
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  keywords: [
    "hotel en Lima",
    "hotel en Miraflores",
    "reserva de habitaciones",
    "suites en Lima",
  ],
  // La canónica evita que "/", "/?utm_source=..." y "/index" compitan entre
  // sí como páginas distintas: todas apuntan a la misma dirección real.
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: siteConfig.title,
    description: siteConfig.description,
  },
};

export default function Home() {
  /**
   * JSON-LD de tipo WebSite: identifica al sitio completo. Es la base para
   * que el buscador entienda que el resto de las páginas (Hotel, HotelRoom)
   * pertenecen a la misma marca.
   */
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: absoluteUrl("/"),
    description: siteConfig.description,
    inLanguage: "es-PE",
    publisher: {
      "@type": "Hotel",
      name: siteConfig.name,
      url: absoluteUrl("/hotel"),
    },
  };

  return (
    <div className="home">
      <JsonLd data={websiteJsonLd} />

      {/*
        Un solo <h1> por página y que describa de qué trata: es la señal más
        fuerte que tiene el buscador sobre el tema del documento. Los títulos
        siguen la jerarquía h1 → h2 → h3, sin saltarse niveles.
      */}
      <section className="home__hero">
        <h1 className="home__title">
          Hotel DMC, tu estadía frente al malecón de Miraflores
        </h1>
        <p className="home__lead">
          Habitaciones individuales, dobles y suites con desayuno incluido, a
          cinco minutos del mar. Reservá online en menos de dos minutos.
        </p>
        <p className="home__actions">
          <Link className="home__cta" href="/habitaciones">
            Ver habitaciones
          </Link>
          <Link className="home__link" href="/hotel">
            Conocer el hotel
          </Link>
        </p>
      </section>

      <section className="home__highlights" aria-labelledby="por-que">
        <h2 id="por-que" className="home__subtitle">
          Por qué reservar con nosotros
        </h2>

        <ul className="home__list">
          <li>
            <h3>Ubicación</h3>
            <p>
              En pleno Miraflores, a pasos del malecón, restaurantes y del
              circuito turístico de Lima.
            </p>
          </li>
          <li>
            <h3>Reserva directa</h3>
            <p>
              Sin intermediarios ni comisiones: el precio que ves es el precio
              que pagás.
            </p>
          </li>
          <li>
            <h3>Todo incluido</h3>
            <p>
              Desayuno buffet, Wi-Fi de fibra y cancelación gratuita hasta 48
              horas antes.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
