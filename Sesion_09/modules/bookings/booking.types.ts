import type { BookingStatus, RoomType } from "@/lib/generated/prisma/enums";

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
}

// Cuerpo esperado por PATCH /api/booking/[id].
export interface UpdateBookingStatusInput {
  status: BookingStatus;
}
