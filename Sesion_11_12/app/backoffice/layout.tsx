import type { Metadata } from "next";
import { requireRole } from "@/modules/auth/auth.session";

/**
 * Zona de reservas: solo ADMIN.
 * El layout es un Server Component, así que este chequeo corre en el servidor
 * antes de mandar nada al navegador. Es la barrera real; `proxy.ts` solo evita
 * el viaje de ida y vuelta.
 */

/**
 * `noindex, nofollow` para toda la zona privada: los layouts también exportan
 * metadata y la heredan sus páginas, así que alcanza con declararlo una vez.
 *
 * Va ADEMÁS del `Disallow` de robots.txt, que hace otra cosa: robots.txt evita
 * la visita, esta etiqueta evita la indexación. Se necesitan las dos porque
 * una URL puede llegar a los resultados sin ser visitada (por un enlace
 * externo) y porque el robots.txt no es obligatorio para nadie.
 */
export const metadata: Metadata = {
  title: "Backoffice",
  robots: { index: false, follow: false },
};

export default async function BackofficeLayout({
  children,
}: LayoutProps<"/backoffice">) {
  await requireRole("ADMIN");

  return children;
}
