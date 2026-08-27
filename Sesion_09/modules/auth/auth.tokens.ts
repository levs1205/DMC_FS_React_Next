import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "@/lib/config/env";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
  REFRESH_TOKEN_TTL_SECONDS,
} from "@/modules/auth/auth.config";
import { isUserRole, type SessionUser } from "@/modules/auth/auth.types";

/**
 * Firma y verificación de los JWT con `jose` (la librería que recomienda la
 * documentación de Next.js: funciona igual en el runtime de Node y en Edge).
 *
 * Cada tipo de token se firma con un secreto distinto y lleva el claim
 * `tokenType`: así un access token nunca puede presentarse como refresh token
 * ni al revés, aunque alguien intercambie las cookies.
 */

const ALGORITHM = "HS256";
const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

const encoder = new TextEncoder();
const accessKey = encoder.encode(authConfig.accessTokenSecret);
const refreshKey = encoder.encode(authConfig.refreshTokenSecret);

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export async function signAccessToken(user: SessionUser): Promise<string> {
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

  return new SignJWT({
    tokenType: ACCESS_TOKEN_TYPE,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(user.id))
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(toUnixSeconds(expiresAt))
    .sign(accessKey);
}

// Devuelve null (en vez de lanzar) ante cualquier token inválido, vencido o
// manipulado: para quien llama, "no hay sesión" y "el token no sirve" es lo mismo.
export async function verifyAccessToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      algorithms: [ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const id = Number(payload.sub);

    if (
      payload.tokenType !== ACCESS_TOKEN_TYPE ||
      !Number.isInteger(id) ||
      !isUserRole(payload.role)
    ) {
      return null;
    }

    return {
      id,
      role: payload.role,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export async function signRefreshToken(
  userId: number
): Promise<IssuedRefreshToken> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  // El jti (id único) evita que dos refresh tokens emitidos en el mismo
  // segundo para el mismo usuario salgan idénticos y choquen en la BD.
  const token = await new SignJWT({ tokenType: REFRESH_TOKEN_TYPE })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(userId))
    .setJti(crypto.randomUUID())
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(toUnixSeconds(expiresAt))
    .sign(refreshKey);

  return { token, expiresAt };
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, refreshKey, {
      algorithms: [ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const userId = Number(payload.sub);

    if (payload.tokenType !== REFRESH_TOKEN_TYPE || !Number.isInteger(userId)) {
      return null;
    }

    return { userId };
  } catch {
    return null;
  }
}
