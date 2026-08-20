"use server";

import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http/api-error";
import { userService } from "@/modules/users/user.service";

export async function loginAction(formData: FormData): Promise<void> {
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");

  let redirectTo = "/intranet";

  try {
    await userService.login({ user, password });
  } catch (error) {
    if (error instanceof ApiError){
        redirectTo = `/login-server?error=${encodeURIComponent(error.message)}`;
    } else{
        redirectTo = `/login-server?error=${encodeURIComponent("Huboo un error al iniciar sesion")}`;
    }
  }

  redirect(redirectTo);
}
