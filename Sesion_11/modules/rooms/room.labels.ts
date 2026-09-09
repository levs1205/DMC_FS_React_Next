import type { RoomType } from "@/modules/rooms/room.types";

/**
 * Traducción de los enums de habitación a texto para la UI.
 *
 * Al tiparlos como `Record<RoomType, string>` el compilador exige que estén
 * TODOS los valores del enum: si mañana se agrega un tipo al schema de
 * Prisma, `tsc` falla acá en vez de mostrar un `undefined` en pantalla.
 */
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  SINGLE: "Individual",
  DOUBLE: "Doble",
  SUITE: "Suite",
};

/**
 * Servicios por tipo de habitación. Se muestran en la página de detalle y,
 * de paso, se publican como `amenityFeature` en el JSON-LD: es el tipo de
 * dato concreto que Google usa para armar los resultados enriquecidos.
 */
export const ROOM_TYPE_AMENITIES: Record<RoomType, readonly string[]> = {
  SINGLE: ["Wi-Fi de fibra", "Desayuno incluido", "Escritorio de trabajo"],
  DOUBLE: ["Wi-Fi de fibra", "Desayuno incluido", "Aire acondicionado", "Caja fuerte"],
  SUITE: [
    "Wi-Fi de fibra",
    "Desayuno incluido",
    "Aire acondicionado",
    "Sala independiente",
    "Vista al malecón",
  ],
};
