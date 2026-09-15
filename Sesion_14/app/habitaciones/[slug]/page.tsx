/**
 * Ruta: "/habitaciones/[slug]" (detalle público de una habitación)
 *
 * Ejemplo de SEO nº 3: la página dinámica, que es donde vive casi todo el
 * tráfico de un hotel real. Reúne cuatro piezas:
 *
 * 1. `generateStaticParams` -> Next prerenderiza una página por habitación,
 *    así el crawler recibe HTML ya hecho y no espera a la base de datos.
 * 2. `generateMetadata`     -> título y descripción distintos por habitación.
 * 3. URL canónica           -> el slug oficial es uno solo; los viejos redirigen.
 * 4. JSON-LD `HotelRoom`    -> precio y capacidad en un formato que el
 *                              buscador entiende sin adivinar.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import "./page.css";
import { formatCurrency } from "@/lib/format/format-currency";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/seo/site.config";
import {
  ROOM_TYPE_AMENITIES,
  ROOM_TYPE_LABELS,
} from "@/modules/rooms/room.labels";
import { findRoomBySlug } from "@/modules/rooms/room.service";

/**
 * Esta ruta se renderiza EN CADA PETICIÓN, no se prerenderiza.
 *
 * Aquí había un `generateStaticParams` que pedía a Next generar el HTML de
 * cada habitación una sola vez, en el build. Es lo que uno querría para una
 * página de catálogo —contenido que casi nunca cambia y que interesa que el
 * crawler reciba ya hecho— pero en esta aplicación es imposible, y conviene
 * entender por qué:
 *
 * El layout raíz (`app/layout.tsx`) llama a `getSessionUser()`, que lee la
 * cookie de sesión para mostrar en la cabecera quién está conectado. Leer una
 * cookie es una **API de request**: su valor depende de QUIÉN pide la página.
 * Eso vuelve dinámica toda la rama que cuelga de ese layout, que es el sitio
 * entero.
 *
 * Si además se declara `generateStaticParams`, se le está pidiendo a Next dos
 * cosas incompatibles: "genera este HTML una vez, sin ningún usuario" y "lee
 * la cookie del usuario". El render estático falla con el digest
 * `DYNAMIC_SERVER_USAGE` y la página responde 500.
 *
 * El síntoma es traicionero porque **depende de los datos**: si en el build
 * hay habitaciones, Next prerenderiza esas rutas y el error aparece solo al
 * pedir una habitación nueva; si la base está vacía en el build —que es lo que
 * pasa en el PRIMER despliegue, antes del seed— falla la primera visita a
 * cualquiera de ellas.
 *
 * Perder el prerenderizado no perjudica al SEO: el crawler sigue recibiendo
 * HTML completo, generado en el servidor. Lo que se pierde es poder cachearlo,
 * y a cambio se gana una cabecera personalizada en todas las páginas.
 *
 * Para recuperar el SSG habría que sacar la lectura de sesión del layout raíz
 * —renderizando la cabecera de usuario aparte— o habilitar PPR, que sirve
 * justamente para combinar un esqueleto estático con islas dinámicas.
 */
export const dynamic = "force-dynamic";

/**
 * Metadata dinámica: depende de datos, así que no puede ser un objeto
 * estático. Next espera esta función antes de mandar el <head>.
 *
 * La consulta parece duplicada con la del componente, pero `findRoomBySlug`
 * está envuelta en `cache()`: en el mismo render se ejecuta una sola vez.
 */
export async function generateMetadata({
  params,
}: PageProps<"/habitaciones/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const room = await findRoomBySlug(slug);

  // Sin datos no hay que inventar metadata: la página va a responder 404.
  if (!room) {
    return {
      title: "Habitación no encontrada",
      robots: { index: false, follow: false },
    };
  }

  const title = `${room.name} - ${ROOM_TYPE_LABELS[room.type]} para ${room.capacity}`;
  const description = `${room.description} Desde ${formatCurrency(
    room.pricePerNight
  )} por noche en el ${siteConfig.name}, Miraflores.`;
  const canonical = `/habitaciones/${room.slug}`;

  return {
    title: room.name,
    description,
    // Siempre el slug CANÓNICO, no el que vino en la URL: así una visita a
    // un slug viejo no genera una segunda página indexada con el mismo texto.
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
    },
  };
}

export default async function RoomDetailPage({
  params,
}: PageProps<"/habitaciones/[slug]">) {
  const { slug } = await params;
  const room = await findRoomBySlug(slug);

  // 404 real (status 404 + not-found.tsx). Devolver un 200 con el texto "no
  // existe" haría que el buscador indexe una página vacía: es la clásica
  // "soft 404".
  if (!room) notFound();

  // El id manda: /habitaciones/suite-vieja-5 sigue encontrando la habitación
  // 5, pero se la redirige (308) al slug actual para no tener dos URLs con
  // el mismo contenido.
  if (slug !== room.slug) permanentRedirect(`/habitaciones/${room.slug}`);

  const canonicalUrl = absoluteUrl(`/habitaciones/${room.slug}`);
  const amenities = ROOM_TYPE_AMENITIES[room.type];

  /**
   * HotelRoom + Offer: el precio, la moneda y la capacidad dejan de ser texto
   * suelto y pasan a ser datos. Es lo que habilita los resultados
   * enriquecidos (precio visible en el buscador).
   *
   * Regla de oro: el JSON-LD solo puede declarar lo que la persona también ve
   * en la página. Si acá dijera S/ 100 y la página mostrara S/ 480, sería
   * spam estructurado.
   */
  const roomJsonLd = {
    "@context": "https://schema.org",
    "@type": "HotelRoom",
    name: room.name,
    description: room.description,
    url: canonicalUrl,
    image: absoluteUrl("/logo.png"),
    occupancy: {
      "@type": "QuantitativeValue",
      maxValue: room.capacity,
      unitCode: "C62", // C62 = "unidad", segun el estandar UN/CEFACT
    },
    amenityFeature: amenities.map((amenity) => ({
      "@type": "LocationFeatureSpecification",
      name: amenity,
      value: true,
    })),
    containedInPlace: {
      "@type": "Hotel",
      name: siteConfig.name,
      url: absoluteUrl("/hotel"),
    },
    offers: {
      "@type": "Offer",
      price: room.pricePerNight,
      priceCurrency: siteConfig.currency,
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: room.pricePerNight,
        priceCurrency: siteConfig.currency,
        // El precio es POR NOCHE, no total: sin esto el buscador podria
        // mostrarlo como el precio de toda la estadía.
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitCode: "DAY",
        },
      },
    },
  };

  return (
    <div className="room">
      <JsonLd data={roomJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: absoluteUrl("/") },
          { name: "Habitaciones", url: absoluteUrl("/habitaciones") },
          { name: room.name, url: canonicalUrl },
        ])}
      />

      {/* Migas de pan visibles: el JSON-LD de BreadcrumbList describe esto
          mismo. Primero la versión para la persona, después la del robot. */}
      <nav className="room__breadcrumb" aria-label="Miga de pan">
        <ol>
          <li>
            <Link href="/">Inicio</Link>
          </li>
          <li>
            <Link href="/habitaciones">Habitaciones</Link>
          </li>
          <li aria-current="page">{room.name}</li>
        </ol>
      </nav>

      <article className="room__content">
        <header className="room__header">
          <h1 className="room__title">{room.name}</h1>
          <p className="room__type">
            {ROOM_TYPE_LABELS[room.type]} - hasta {room.capacity}{" "}
            {room.capacity === 1 ? "huésped" : "huéspedes"}
          </p>
          <p className="room__price">
            {formatCurrency(room.pricePerNight)}{" "}
            <span className="room__price-unit">por noche</span>
          </p>
        </header>

        <section aria-labelledby="descripcion">
          <h2 id="descripcion">Sobre la habitación</h2>
          <p>{room.description}</p>
        </section>

        <section aria-labelledby="servicios">
          <h2 id="servicios">Servicios incluidos</h2>
          <ul className="room__amenities">
            {amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        </section>

        <footer className="room__actions">
          <Link className="room__cta" href="/login">
            Reservar esta habitación
          </Link>
          <Link className="room__back" href="/habitaciones">
            Ver todas las habitaciones
          </Link>
        </footer>
      </article>
    </div>
  );
}
