import type { BookingStatus, RoomType } from "@/lib/generated/prisma/enums";
import type { PaymentSummary } from "@/modules/payments/payment.types";

// Se reexportan para que la UI no tenga que importar del cliente generado.
export type { BookingStatus, RoomType };

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
  totalPrice: number;
  nights: number;
  pricePerNight: number;
}

// Cuerpo esperado por PATCH /api/booking/[id].
export interface UpdateBookingStatusInput {
  status: BookingStatus;
}

export const BLOCKING_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "PAID",
  "PAYMENT_FAILED",
] as const satisfies readonly BookingStatus[];

export interface BookingWithPayment extends BookingListItem {
  payment: PaymentSummary | null;
}

export interface CreateBookingInput {
  roomId: number;
  startDate: string;
  endDate: string;
}
