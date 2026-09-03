import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/seo/site.config";

/**
 * app/opengraph-image.tsx -> imagen que se ve al compartir el enlace.
 *
 * Es un archivo de convención: con solo existir, Next agrega las etiquetas
 * <meta property="og:image"> (con su url, ancho, alto y alt) a esta ruta y a
 * todas las que cuelgan de ella. Se hereda igual que la metadata, así que
 * este archivo en la raíz cubre todo el sitio.
 *
 * `ImageResponse` dibuja un PNG con JSX y un subconjunto de CSS (flexbox sí,
 * grid no). Se genera en el build, no en cada visita.
 */
export const alt = `${siteConfig.name} - reserva de habitaciones en Lima`;
export const size = { width: 1200, height: 630 }; // medida estándar de OG
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: 80,
          background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 6, color: "#9ca3af" }}>
          MIRAFLORES · LIMA
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
          {siteConfig.name}
        </div>
        <div style={{ fontSize: 34, color: "#d1d5db", maxWidth: 900 }}>
          Individuales, dobles y suites frente al malecón. Reserva directa,
          sin comisiones.
        </div>
      </div>
    ),
    size
  );
}
