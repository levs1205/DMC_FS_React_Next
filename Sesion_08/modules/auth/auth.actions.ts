"use server";

import { LOGIN_PATH } from "@/modules/auth/auth.config"
import { redirect } from "next/navigation"
import {
    deleteSessionCookies,
    readSessionCookies,
} from "@/modules/auth/auth.cookies"
import { authService } from "@/modules/auth/auth.service"


export async function logoutAction(): Promise<void>{
    const { refreshToken } = await readSessionCookies();

    await authService.logout(refreshToken);

    await deleteSessionCookies();
    redirect(LOGIN_PATH);
}