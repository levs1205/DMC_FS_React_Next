/**
 * Ruta: "/habitaciones" (catálogo público)
 *
 * Ejemplo de SEO nº 2: una página de listado. Lo importante acá es que el
 * HTML se arma en el servidor con los datos de la base, que cada habitación
 * sea un enlace real (<a href>) para que el crawler pueda seguirlo, y que el
 * listado se declare también como datos estructurados (ItemList).
 */
import type { Metadata } from "next";
import Link from "next/link";
import "./page.css";
import { formatCurrency } from "@/lib/format/format-currency";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/seo/site.config";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import { listRooms } from "@/modules/rooms/room.service";

const PAGE_TITLE = "Habitaciones";
const PAGE_DESCRIPTION =
  "Individuales, dobles y suites frente al malecón de Miraflores. Consultá servicios, capacidad y precio por noche de cada habitación del Hotel DMC.";

export const metadata: Metadata = {
  // Título corto: el layout le agrega " | Hotel DMC" con su `template`.
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/habitaciones" },
  openGraph: {
    title: `${PAGE_TITLE} | ${siteConfig.name}`,
    description: PAGE_DESCRIPTION,
    url: "/habitaciones",
  },
};

export default async function RoomsPage() {
  const rooms = await listRooms();

  /**
   * ItemList: le dice al buscador que esto es un listado y en qué orden va.
   * Solo se declaran las URLs; el detalle de cada habitación lo publica su
   * propia página como HotelRoom.
   */
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Habitaciones del ${siteConfig.name}`,
    numberOfItems: rooms.length,
    itemListElement: rooms.map((room, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: room.name,
      url: absoluteUrl(`/habitaciones/${room.slug}`),
    })),
  };

  return (
    <div className="rooms">
      <JsonLd data={itemListJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: absoluteUrl("/") },
          { name: PAGE_TITLE, url: absoluteUrl("/habitaciones") },
        ])}
      />

      {/* <header> también sirve dentro de una sección: es la cabecera de este
          contenido, no la del sitio. */}
      <header className="rooms__header">
        <h1 className="rooms__title">Habitaciones</h1>
        <p className="rooms__intro">{PAGE_DESCRIPTION}</p>
      </header>

      {rooms.length === 0 ? (
        <p className="rooms__empty">
          No hay habitaciones publicadas en este momento.
        </p>
      ) : (
        /* Una lista de cosas se marca como lista: <ul> + <li>. Cada ítem es
           un <article> porque se entiende por sí solo fuera del listado. */
        <ul className="rooms__list">
          {rooms.map((room) => (
            <li key={room.id}>
              <article className="room-card">
                <h2 className="room-card__name">
                  {/* El enlace envuelve al título: el texto del <a> es lo que
                      el buscador usa para saber de qué trata el destino.
                      "Ver más" no le dice nada a nadie. */}
                  <Link href={`/habitaciones/${room.slug}`}>{room.name}</Link>
                </h2>

                {/* <dl> es la etiqueta para pares dato/valor (ficha técnica). */}
                <dl className="room-card__specs">
                  <div>
                    <dt>Tipo</dt>
                    <dd>{ROOM_TYPE_LABELS[room.type]}</dd>
                  </div>
                  <div>
                    <dt>Capacidad</dt>
                    <dd>
                      {room.capacity}{" "}
                      {room.capacity === 1 ? "huésped" : "huéspedes"}
                    </dd>
                  </div>
                  <div>
                    <dt>Precio por noche</dt>
                    <dd className="room-card__price">
                      {formatCurrency(room.pricePerNight)}
                    </dd>
                  </div>
                </dl>

                <p className="room-card__description">{room.description}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
