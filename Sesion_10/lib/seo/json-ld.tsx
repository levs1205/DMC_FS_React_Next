/**
 * Componente para inyectar datos estructurados (JSON-LD) en la página.
 *
 * Se usa un <script> nativo y NO `next/script`: JSON-LD no es código que se
 * ejecute, es contenido que el crawler lee del HTML. Con `next/script` podría
 * inyectarse tarde y el bot no lo vería.
 *
 * `dangerouslySetInnerHTML` es obligatorio (React escaparía el JSON), así que
 * se escapa el carácter "<" a su equivalente unicode: si un dato de la base
 * trajera "</script>", cerraría la etiqueta e inyectaría HTML arbitrario.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\u003c"),
      }}
    />
  );
}

/**
 * Migas de pan para el buscador: es lo que hace que Google muestre
 * "hoteldmc.pe > Habitaciones > Suite Miraflores" en vez de la URL cruda.
 * Recibe los ítems ya en orden (del más general al más específico).
 */
export function breadcrumbJsonLd(
  items: readonly { name: string; url: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
