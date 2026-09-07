import type { UserRole } from "@/modules/auth/auth.types";

// Nombre del rol para mostrar en pantalla (mismo criterio que booking.labels).
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Estudiante",
  ADMIN: "Administrador",
};
