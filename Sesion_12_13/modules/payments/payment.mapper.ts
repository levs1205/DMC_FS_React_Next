import type { BookingStatus } from "@/modules/bookings/booking.types";
import type { MercadoPagoPayment } from "@/modules/payments/mercadopago/mercadopago.types";
import type { PaymentStatus } from "@/modules/payments/payment.types";

/**
 * Traducción de los estados de Mercado Pago a los del dominio.
 *
 * Es la única parte del código que conoce el vocabulario del proveedor. Si
 * mañana se suma otra pasarela, alcanza con escribir otro mapper: ni el
 * servicio ni la UI cambian.
 */
export interface PaymentOutcome {
  paymentStatus: PaymentStatus;
  /**
   * Nuevo estado de la RESERVA, o null cuando el resultado del cobro no
   * debería moverla (por ejemplo un pago cancelado: la reserva sigue
   * pendiente y el alumno puede reintentar).
   */
  bookingStatus: BookingStatus | null;
  paidAt: Date | null;
}

export function mapPayment(payment: MercadoPagoPayment): PaymentOutcome {
  switch (payment.status) {
    case "approved":
      return {
        paymentStatus: "APPROVED",
        bookingStatus: "PAID",
        paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
      };

    // "authorized" es una tarjeta con el monto retenido pero todavía sin
    // capturar: hay plata comprometida, no cobrada. Se trata como en curso.
    case "authorized":
    case "in_process":
    case "in_mediation":
      return { paymentStatus: "IN_PROCESS", bookingStatus: "PENDING", paidAt: null };

    case "pending":
      return { paymentStatus: "PENDING", bookingStatus: "PENDING", paidAt: null };

    case "rejected":
      return {
        paymentStatus: "REJECTED",
        bookingStatus: "PAYMENT_FAILED",
        paidAt: null,
      };

    // Cancelado (o vencido) no es lo mismo que rechazado: nadie intentó
    // cobrar. La reserva vuelve a quedar pendiente para reintentar el pago.
    case "cancelled":
      return { paymentStatus: "CANCELLED", bookingStatus: "PENDING", paidAt: null };

    case "refunded":
    case "charged_back":
      return {
        paymentStatus: "REFUNDED",
        bookingStatus: "CANCELLED",
        paidAt: null,
      };
  }
}

/**
 * Estados finales del cobro: una vez que se llega a uno, una notificación
 * atrasada no puede hacer retroceder el estado.
 *
 * Los webhooks de Mercado Pago pueden llegar duplicados y fuera de orden
 * (primero "approved" y después la notificación de "pending" que se demoró en
 * la red). Sin esta regla, una reserva ya pagada volvería a figurar pendiente.
 */
export function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return status === "APPROVED" || status === "REFUNDED";
}
