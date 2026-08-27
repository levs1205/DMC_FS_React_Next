import { requireRole } from "@/modules/auth/auth.session";

/**
 * Zona de reservas: solo ADMIN.
 * El layout es un Server Component, así que este chequeo corre en el servidor
 * antes de mandar nada al navegador. Es la barrera real; `proxy.ts` solo evita
 * el viaje de ida y vuelta.
 */
export default async function BackofficeLayout({
  children,
}: LayoutProps<"/backoffice">) {
  await requireRole("ADMIN");

  return children;
}
