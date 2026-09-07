import { NextResponse, type NextRequest } from "next/server"
import {
    ACCESS_TOKEN_COOKIE,
    HOME_PATH,
    LOGIN_PATH,
    REFRESH_PATH,
    REFRESH_TOKEN_COOKIE,
    findRouteRule,
} from "@/modules/auth/auth.config"
import { verifyAccessToken } from "@/modules/auth/auth.tokens"


export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const session = accessToken ? await verifyAccessToken(accessToken) : null;

  const rule = findRouteRule(pathname);
  const isLoginPage = pathname === LOGIN_PATH;

  if (!session) {
    const hasRefreshToken = Boolean(
      request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
    );

    if (hasRefreshToken && (rule || isLoginPage)) {
      const refreshUrl = new URL(REFRESH_PATH, request.nextUrl);
      refreshUrl.searchParams.set("next", `${pathname}${search}`);

      return NextResponse.redirect(refreshUrl);
    }

    if (rule) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl));
    }

    return NextResponse.next();
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL(HOME_PATH, request.nextUrl));
  }

  return NextResponse.next();
}