"use server";

import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http/api-error";
import { userService } from "@/modules/users/user.service";

// Server Action: reutiliza userService.login directamente (misma lógica que
// usa la API route), sin pasar por una petición HTTP ni JavaScript de cliente.
export async function loginAction(formData: FormData): Promise<void> {
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");

  let redirectTo = "/intranet";

  try {
    await userService.login({ user, password });
  } catch (error) {
    if (error instanceof ApiError) {
      redirectTo = `/login-server?error=${encodeURIComponent(error.message)}`;
    } else {
      console.error(error);
      redirectTo = `/login-server?error=${encodeURIComponent("No se pudo iniciar sesión.")}`;
    }
  }

  redirect(redirectTo);
}
