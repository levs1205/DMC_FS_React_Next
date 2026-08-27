import { createHash } from "node:crypto";
import { ApiError } from "@/lib/http/api-error";
import { REFRESH_ROTATION_THRESHOLD_SECONDS } from "@/modules/auth/auth.config";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/modules/auth/auth.tokens";
import type { SessionTokens, SessionUser } from "@/modules/auth/auth.types";
import { refreshTokenRepository } from "@/modules/auth/refresh-token.repository";
import { userService } from "@/modules/users/user.service";
import type { LoginCredentials, PublicUser } from "@/modules/users/user.types";

/**
 * Ciclo de vida de la sesión.
 *
 * - El access token es stateless: se valida solo con la firma, sin tocar la BD.
 *   Por eso dura poco (15 min): es la única ventana en la que un token robado
 *   o un rol ya cambiado siguen siendo válidos.
 * - El refresh token sí queda registrado en la tabla `refresh_token`, guardando
 *   únicamente su SHA-256. Eso permite lo que un JWT suelto no permite:
 *   revocarlo (logout) y detectar su reutilización.
 */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toSessionUser(user: PublicUser): SessionUser {
  return { id: user.id, name: user.name, role: user.role };
}

async function issueTokens(
  user: SessionUser,
  existingRefreshToken?: { token: string; expiresAt: Date }
): Promise<SessionTokens> {
  const accessToken = await signAccessToken(user);

  if (existingRefreshToken) {
    return {
      accessToken,
      refreshToken: existingRefreshToken.token,
      refreshTokenExpiresAt: existingRefreshToken.expiresAt,
    };
  }

  const refresh = await signRefreshToken(user.id);

  await refreshTokenRepository.create({
    tokenHash: hashToken(refresh.token),
    userId: user.id,
    expiresAt: refresh.expiresAt,
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

export interface AuthenticatedSession {
  user: SessionUser;
  tokens: SessionTokens;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthenticatedSession> {
    const user = toSessionUser(await userService.verifyCredentials(credentials));

    // Higiene: cada login aprovecha para borrar los tokens ya vencidos.
    await refreshTokenRepository.deleteStaleForUser(user.id);

    return { user, tokens: await issueTokens(user) };
  },

  /**
   * Renueva el access token a partir del refresh token.
   *
   * Comprueba, en este orden: firma y vencimiento del JWT, que el token siga
   * registrado, que no esté revocado y que el usuario siga existiendo. El rol
   * se vuelve a leer de la base, así un cambio de rol se aplica como máximo
   * en el siguiente refresh y no cuando caduque la sesión entera.
   */
  async refresh(rawRefreshToken: string): Promise<AuthenticatedSession> {
    const payload = await verifyRefreshToken(rawRefreshToken);

    if (!payload) {
      throw new ApiError(401, "La sesión expiró. Vuelve a iniciar sesión.");
    }

    const tokenHash = hashToken(rawRefreshToken);
    const stored = await refreshTokenRepository.findByHash(tokenHash);

    if (!stored || stored.userId !== payload.userId) {
      throw new ApiError(401, "La sesión expiró. Vuelve a iniciar sesión.");
    }

    // Reutilización de un token ya revocado: o alguien lo robó, o es una copia
    // vieja. Ante la duda se cierran TODAS las sesiones de ese usuario.
    if (stored.revokedAt) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new ApiError(401, "La sesión se cerró por seguridad. Vuelve a iniciar sesión.");
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await refreshTokenRepository.revoke(stored.id);
      throw new ApiError(401, "La sesión expiró. Vuelve a iniciar sesión.");
    }

    const user = await userService.findById(stored.userId);

    if (!user) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new ApiError(401, "La sesión ya no es válida.");
    }

    const sessionUser = toSessionUser(user);
    const secondsLeft = (stored.expiresAt.getTime() - Date.now()) / 1000;

    // Sesión deslizante: pasada la mitad de su vida, el refresh token se
    // reemplaza por uno nuevo y el viejo queda revocado (rotación).
    if (secondsLeft > REFRESH_ROTATION_THRESHOLD_SECONDS) {
      const tokens = await issueTokens(sessionUser, {
        token: rawRefreshToken,
        expiresAt: stored.expiresAt,
      });
      return { user: sessionUser, tokens };
    }

    const tokens = await issueTokens(sessionUser);
    await refreshTokenRepository.revoke(stored.id);

    return { user: sessionUser, tokens };
  },

  // Cierra la sesión de este navegador. Los demás dispositivos siguen abiertos.
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;

    const stored = await refreshTokenRepository.findByHash(
      hashToken(rawRefreshToken)
    );

    if (stored) {
      await refreshTokenRepository.revoke(stored.id);
    }
  },
};
