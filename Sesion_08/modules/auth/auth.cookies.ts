import type { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { 
    ACCESS_TOKEN_COOKIE,
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_COOKIE,
 } from "@/modules/auth/auth.config"
 import type { SessionToken } from "@/modules/auth/auth.types"

 const isProduction = process.env.NODE_ENV === "production"

 const baseCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    path: "/",
 } as const;

 const ACCESS_COOKIE_MAX_AGE = ACCESS_TOKEN_TTL_SECONDS + 60;

 export function applySessionCookies<T extends NextResponse>(response: T, tokens: SessionToken): T {
    response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
        ...baseCookieOptions,
        sameSite: "lax",
        maxAge: ACCESS_COOKIE_MAX_AGE
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
        ...baseCookieOptions,
        sameSite: "strict",
        expires: tokens.refreshTokenExpireAt
    });

    return response;
 }

  export function clearSessionCookies<T extends NextResponse>(response: T): T {
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
        ...baseCookieOptions,
        sameSite: "lax",
        maxAge: 0
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
        ...baseCookieOptions,
        sameSite: "strict",
        maxAge: 0
    });

    return response;
 }


export async function readSessionCookies(): Promise<{ accessToken?: string, refreshToken?: string }>{
    const store = await cookies();
    return {
        accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value,
        refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value,
    }
}


export async function deleteSessionCookies(): Promise<void>{
    const store = await cookies();
    store.delete(ACCESS_TOKEN_COOKIE);
    store.delete(REFRESH_TOKEN_COOKIE);
}

