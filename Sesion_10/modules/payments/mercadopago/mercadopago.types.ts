/**
 * Recorte tipado de la API de Mercado Pago.
 *
 * Solo se declaran los campos que este proyecto realmente usa: la respuesta
 * real trae decenas más. Escribir el contrato a mano (en vez de un `any`)
 * hace que un cambio de nombre en la API se vea como un error de compilación
 * en el mapper, y no como un `undefined` en producción.
 */

// --- Preferencia (el "pedido" que se abre en el Checkout Pro) --------------

export interface PreferenceItem {
  id: string;
  title: string;
  description: string;
  category_id: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

export interface PreferenceRequest {
  items: PreferenceItem[];
  payer: { name?: string; email?: string };
  external_reference: string;
  statement_descriptor: string;
  metadata: Record<string, string | number>;
  binary_mode: boolean;
  expires: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  back_urls?: { success: string; failure: string; pending: string };
  auto_return?: "approved";
  notification_url?: string;
}

export interface PreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  external_reference?: string;
}

// --- Pago ------------------------------------------------------------------

/** Estados posibles de un pago según la documentación de Mercado Pago. */
export type MercadoPagoPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export interface MercadoPagoPayment {
  id: number;
  status: MercadoPagoPaymentStatus;
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
  date_created: string;
  payment_method_id: string | null;
  payment_type_id: string | null;
}

export interface PaymentSearchResponse {
  paging: { total: number; limit: number; offset: number };
  results: MercadoPagoPayment[];
}

// --- Webhook ---------------------------------------------------------------

/** Cuerpo de la notificación que Mercado Pago envía a `notification_url`. */
export interface WebhookNotification {
  id?: number;
  type?: string;
  action?: string;
  live_mode?: boolean;
  data?: { id?: string };
}
