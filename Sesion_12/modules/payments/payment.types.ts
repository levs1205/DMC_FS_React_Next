import type { PaymentStatus } from "@/lib/generated/prisma/enums";
import type { BookingStatus, RoomType } from "@/modules/bookings/booking.types";

// Se reexporta para que la UI no importe del cliente generado por Prisma.
export type { PaymentStatus };

/**
 * Intento de cobro listo para viajar por HTTP o hacia un Client Component:
 * montos como number y fechas como ISO (en la base son Decimal y Date, que no
 * son serializables).
 *
 * `quotationId` es el número de pedido que ve el usuario y el mismo que
 * identifica la operación del lado de Mercado Pago.
 */
export interface PaymentSummary {
  quotationId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  /**
   * Motivo técnico que devuelve Mercado Pago ("cc_rejected_insufficient_amount",
   * "accredited"...). Es lo que alimenta el diálogo con el detalle del rechazo.
   */
  statusDetail: string | null;
  providerPaymentId: string | null;
  paidAt: string | null;
}

/** Lo que necesita el botón "Pagar" una vez creada la preferencia. */
export interface CheckoutRedirect {
  quotationId: string;
  initPoint: string;
}

/**
 * Datos de la reserva que acompañan a un cobro. Es un recorte a propósito:
 * la pantalla de pago y la de resultado solo necesitan esto, y así el
 * quotationId no arrastra consigo los datos personales del huésped.
 */
export interface CheckoutBooking {
  id: number;
  status: BookingStatus;
  roomName: string;
  roomType: RoomType;
  startDate: string;
  endDate: string;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
}

/** Lo que se pinta en la página de pago y en la de resultado. */
export interface CheckoutView {
  payment: PaymentSummary;
  booking: CheckoutBooking;
}
