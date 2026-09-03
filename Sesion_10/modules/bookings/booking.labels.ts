import type {
  BookingStatus,
  RoomType,
} from "@/modules/bookings/booking.types";

/**
 * Traducción de los enums de la base de datos a texto para la UI.
 *
 * Al tiparlos como `Record<BookingStatus, string>` el compilador exige que
 * estén TODOS los valores del enum: si mañana se agrega un estado al schema
 * de Prisma, `tsc` falla aquí en vez de mostrar un `undefined` en pantalla.
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reprogramada",
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  SINGLE: "Individual",
  DOUBLE: "Doble",
  SUITE: "Suite",
};
