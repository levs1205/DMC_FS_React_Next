/**
 * Ruta: "/hotel" (página institucional)
 *
 * Ejemplo de SEO nº 4: la página "de negocio". Acá el objetivo no es vender
 * una habitación sino que el buscador entienda QUÉ es este sitio y DÓNDE
 * está (SEO local). Dos datos estructurados:
 *
 * - `Hotel`   -> dirección, teléfono, coordenadas, rango de precios.
 * - `FAQPage` -> las preguntas frecuentes, que Google puede mostrar
 *                desplegables debajo del resultado.
 *
 * Las preguntas se declaran UNA sola vez (constante `FAQ`) y de ahí salen
 * tanto el HTML como el JSON-LD: si se editan en un lado y no en el otro,
 * el dato estructurado deja de coincidir con lo visible y Google lo ignora.
 */
import type { Metadata } from "next";
import Link from "next/link";
import "./page.css";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { absoluteUrl, siteConfig } from "@/lib/seo/site.config";

const PAGE_TITLE = "El hotel";
const PAGE_DESCRIPTION =
  "Hotel DMC es un hotel boutique de 24 habitaciones en el malecón de Miraflores, Lima: desayuno buffet, Wi-Fi de fibra y recepción 24 horas.";

const FAQ = [
  {
    question: "¿A qué hora son el check-in y el check-out?",
    answer:
      "El check-in es a partir de las 15:00 y el check-out hasta las 12:00. Guardamos el equipaje sin costo si llegás antes o salís después.",
  },
  {
    question: "¿El desayuno está incluido?",
    answer:
      "Sí. Todas las habitaciones incluyen desayuno buffet de 6:30 a 10:30 en el comedor del primer piso.",
  },
  {
    question: "¿Puedo cancelar mi reserva?",
    answer:
      "La cancelación es gratuita hasta 48 horas antes del check-in. Después de ese plazo se cobra la primera noche.",
  },
] as const;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/hotel" },
  openGraph: {
    title: `${PAGE_TITLE} | ${siteConfig.name}`,
    description: PAGE_DESCRIPTION,
    url: "/hotel",
  },
};

export default function HotelPage() {
  const hotelJsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: siteConfig.name,
    description: PAGE_DESCRIPTION,
    url: absoluteUrl("/hotel"),
    image: absoluteUrl("/logo.png"),
    telephone: siteConfig.telephone,
    email: siteConfig.email,
    priceRange: siteConfig.priceRange,
    currenciesAccepted: siteConfig.currency,
    starRating: { "@type": "Rating", ratingValue: 4 },
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.region,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.geo.latitude,
      longitude: siteConfig.geo.longitude,
    },
    checkinTime: "15:00",
    checkoutTime: "12:00",
    amenityFeature: [
      "Desayuno buffet incluido",
      "Wi-Fi de fibra",
      "Recepción 24 horas",
      "Terraza con vista al mar",
    ].map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="hotel">
      <JsonLd data={hotelJsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: absoluteUrl("/") },
          { name: PAGE_TITLE, url: absoluteUrl("/hotel") },
        ])}
      />

      <header className="hotel__header">
        <h1 className="hotel__title">El Hotel DMC</h1>
        <p className="hotel__lead">{PAGE_DESCRIPTION}</p>
      </header>

      <section className="hotel__section" aria-labelledby="ubicacion">
        <h2 id="ubicacion">Dónde estamos</h2>
        {/* <address> es la etiqueta correcta para los datos de contacto del
            responsable del contenido; no es "texto en cursiva". */}
        <address className="hotel__address">
          {siteConfig.address.street}
          <br />
          {siteConfig.address.city}, {siteConfig.address.region}{" "}
          {siteConfig.address.postalCode}
          <br />
          <a href={`tel:${siteConfig.telephone.replace(/\s/g, "")}`}>
            {siteConfig.telephone}
          </a>
          <br />
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
        </address>
      </section>

      <section className="hotel__section" aria-labelledby="servicios">
        <h2 id="servicios">Servicios del hotel</h2>
        <ul className="hotel__amenities">
          <li>Desayuno buffet incluido, de 6:30 a 10:30</li>
          <li>Wi-Fi de fibra en todo el edificio</li>
          <li>Recepción 24 horas y guardado de equipaje</li>
          <li>Terraza con vista al mar</li>
        </ul>
      </section>

      <section className="hotel__section" aria-labelledby="faq">
        <h2 id="faq">Preguntas frecuentes</h2>
        {/* <details>/<summary>: el contenido está en el HTML aunque se vea
            plegado, así que el buscador lo lee igual. Un acordeón hecho con
            JavaScript que inserta el texto al hacer clic, no. */}
        {FAQ.map((item) => (
          <details key={item.question} className="hotel__faq">
            <summary>
              <h3>{item.question}</h3>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <p className="hotel__actions">
        <Link className="hotel__cta" href="/habitaciones">
          Ver habitaciones disponibles
        </Link>
      </p>
    </div>
  );
}
