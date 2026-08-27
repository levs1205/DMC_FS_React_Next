"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/modules/auth/auth.config";
import {
  deleteSessionCookies,
  readSessionCookies,
} from "@/modules/auth/auth.cookies";
import { authService } from "@/modules/auth/auth.service";

/**
 * Cierre de sesión desde el <form> del header. Al ser una Server Action el
 * botón funciona incluso sin JavaScript, y el refresh token queda revocado en
 * la base: borrar la cookie no alcanzaría, porque el token seguiría sirviendo.
 */
export async function logoutAction(): Promise<void> {
  const { refreshToken } = await readSessionCookies();

  await authService.logout(refreshToken);
  await deleteSessionCookies();

  redirect(LOGIN_PATH);
}
