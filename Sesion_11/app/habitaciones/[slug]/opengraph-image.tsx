import { ImageResponse } from "next/og";
import { formatCurrency } from "@/lib/format/format-currency";
import { siteConfig } from "@/lib/seo/site.config";
import { ROOM_TYPE_LABELS } from "@/modules/rooms/room.labels";
import { findRoomBySlug } from "@/modules/rooms/room.service";

/**
 * Imagen de Open Graph POR HABITACIÓN.
 *
 * Misma convención que la de la raíz, pero acá recibe los `params` de la
 * ruta: cada habitación comparte su propia tarjeta, con su nombre y su
 * precio. Al estar más adentro en el árbol, pisa a `app/opengraph-image.tsx`.
 */
export const alt = "Habitación del Hotel DMC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function RoomOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = await findRoomBySlug(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#111827",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, letterSpacing: 6, color: "#9ca3af" }}>
          {siteConfig.name.toUpperCase()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
            {room?.name ?? "Habitaciones"}
          </div>
          <div style={{ fontSize: 34, color: "#d1d5db" }}>
            {room
              ? `${ROOM_TYPE_LABELS[room.type]} · hasta ${room.capacity} huéspedes`
              : "Individuales, dobles y suites en Miraflores"}
          </div>
        </div>

        <div style={{ fontSize: 44, fontWeight: 700, color: "#34d399" }}>
          {room ? `${formatCurrency(room.pricePerNight)} por noche` : ""}
        </div>
      </div>
    ),
    size
  );
}
