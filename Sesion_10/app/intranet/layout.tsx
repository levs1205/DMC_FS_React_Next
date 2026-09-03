import { requireRole } from "@/modules/auth/auth.session";

// Zona de la intranet: solo STUDENT (mismo criterio que el backoffice).
export default async function IntranetLayout({
  children,
}: LayoutProps<"/intranet">) {
  await requireRole("STUDENT");

  return children;
}
