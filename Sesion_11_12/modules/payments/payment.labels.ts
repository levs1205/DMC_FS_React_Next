import type { PaymentStatus } from "@/modules/payments/payment.types";

/**
 * Traducción de los estados del pago a texto para la UI. Tipado como
 * `Record<PaymentStatus, string>` para que agregar un estado al schema rompa
 * la compilación en vez de mostrar un `undefined` en pantalla.
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pendiente de pago",
  IN_PROCESS: "En revisión",
  APPROVED: "Pagado",
  REJECTED: "Pago rechazado",
  CANCELLED: "Pago cancelado",
  REFUNDED: "Pago devuelto",
};

/**
 * Motivos de rechazo de Mercado Pago (`status_detail`) explicados
 * con la acción concreta que le queda al usuario.
 *
 * Mercado Pago devuelve un código técnico; mostrárselo tal cual al alumno no
 * le dice nada. Esta tabla es la que llena el diálogo "por qué no se realizó
 * el pago". Los códigos que no estén listados caen en el mensaje genérico.
 */
export const PAYMENT_STATUS_DETAIL_LABELS: Record<string, string> = {
  accredited: "El pago se acreditó correctamente.",
  pending_contingency:
    "Mercado Pago está procesando el pago. En unos minutos vas a tener el resultado.",
  pending_review_manual:
    "Mercado Pago está revisando el pago manualmente. Te avisará cuando termine.",
  pending_waiting_payment:
    "Falta completar el pago en el medio elegido (efectivo o transferencia).",
  pending_waiting_transfer: "Falta confirmar la transferencia desde tu banco.",
  cc_rejected_bad_filled_card_number:
    "El número de la tarjeta está mal escrito. Revisalo e intentá de nuevo.",
  cc_rejected_bad_filled_date:
    "La fecha de vencimiento de la tarjeta está mal escrita.",
  cc_rejected_bad_filled_security_code:
    "El código de seguridad (CVV) de la tarjeta es incorrecto.",
  cc_rejected_bad_filled_other:
    "Alguno de los datos de la tarjeta es incorrecto. Revisalos e intentá de nuevo.",
  cc_rejected_blacklist:
    "Mercado Pago no pudo procesar el pago con esa tarjeta. Probá con otra.",
  cc_rejected_call_for_authorize:
    "Tu banco tiene que autorizar el pago. Llamalo y volvé a intentar.",
  cc_rejected_card_disabled:
    "La tarjeta está inhabilitada. Comunicate con tu banco para activarla.",
  cc_rejected_card_error:
    "No se pudo procesar el pago con esa tarjeta. Probá con otro medio.",
  cc_rejected_duplicated_payment:
    "Ya se registró un pago por ese mismo monto. Revisá tus reservas antes de reintentar.",
  cc_rejected_high_risk:
    "Mercado Pago rechazó el pago por seguridad. Probá con otro medio de pago.",
  cc_rejected_insufficient_amount: "La tarjeta no tiene fondos suficientes.",
  cc_rejected_invalid_installments:
    "La tarjeta no acepta esa cantidad de cuotas.",
  cc_rejected_max_attempts:
    "Se alcanzó el límite de intentos permitidos. Probá con otra tarjeta.",
  cc_rejected_card_type_not_allowed:
    "Ese tipo de tarjeta no está habilitado para este cobro.",
  cc_rejected_other_reason:
    "El banco rechazó el pago sin dar un motivo. Probá con otro medio de pago.",
  expired: "La orden de pago venció antes de completarse.",
  by_collector: "El cobro se canceló desde el hotel.",
  by_payer: "Cancelaste el pago antes de completarlo.",
};

const FALLBACK_DETAIL =
  "Mercado Pago no pudo completar el cobro. Probá nuevamente con otro medio de pago.";

/** Traduce el `status_detail` crudo al texto que se muestra en el diálogo. */
export function describePaymentDetail(statusDetail: string | null): string {
  if (!statusDetail) return FALLBACK_DETAIL;

  return PAYMENT_STATUS_DETAIL_LABELS[statusDetail] ?? FALLBACK_DETAIL;
}
