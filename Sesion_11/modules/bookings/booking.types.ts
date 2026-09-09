import type { BookingStatus, RoomType } from "@/lib/generated/prisma/enums";
import type { PaymentSummary } from "@/modules/payments/payment.types";

// Se reexportan para que la UI no tenga que importar del cliente generado.
export type { BookingStatus, RoomType };

/**
 * Estados que OCUPAN la habitación en un rango de fechas.
 *
 * Todo lo que no esté cancelado bloquea: una reserva con el pago rechazado
 * sigue reservando la habitación para que el alumno pueda reintentar el cobro
 * sin que otro se la lleve mientras tanto.
 */
export const BLOCKING_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "PAID",
  "PAYMENT_FAILED",
] as const satisfies readonly BookingStatus[];

// Reserva lista para viajar por HTTP: fechas en ISO corto ("YYYY-MM-DD") y
// montos como number (en la BD son DECIMAL y Prisma los entrega como Decimal).
export interface BookingListItem {
  id: number;
  roomId: number;
  roomName: string;
  roomType: RoomType;
  userId: number;
  userName: string | null;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
}

/**
 * La reserva más su último intento de cobro. Es lo que necesitan el listado
 * del alumno (para decidir si muestra "Pagar" o el detalle del rechazo) y la
 * página de pago.
 */
export interface BookingWithPayment extends BookingListItem {
  payment: PaymentSummary | null;
}

// Cuerpo esperado por PATCH /api/booking/[id].
export interface UpdateBookingStatusInput {
  status: BookingStatus;
}

// Cuerpo esperado por POST /api/booking.
export interface CreateBookingInput {
  roomId: number;
  startDate: string;
  endDate: string;
}
