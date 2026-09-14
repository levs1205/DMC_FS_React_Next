import type { Metadata } from "next";
import { requireRole } from "@/modules/auth/auth.session";

// Zona de la intranet: solo STUDENT (mismo criterio que el backoffice).

// Contenido privado: no se indexa ni se siguen sus enlaces.
export const metadata: Metadata = {
  title: "Intranet",
  robots: { index: false, follow: false },
};

export default async function IntranetLayout({
  children,
}: LayoutProps<"/intranet">) {
  await requireRole("STUDENT");

  return children;
}
