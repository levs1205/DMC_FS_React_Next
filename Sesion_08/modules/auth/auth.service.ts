import { ApiError } from "@/lib/http/api-error";
import { createHash } from "node:crypto";
import type { SessionToken, SessionUser } from "@/modules/auth/auth.types";
import type { LoginCredentials, PublicUser } from "@/modules/users/user.types";
import { refreshTokenRepository } from "@/modules/auth/refresh.token.repository";
import { userService } from "@/modules/users/user.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./auth.tokens";
import { REFRESH_ROTATE_THRESHOLD_SECONDS } from "@/modules/auth/auth.config";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toSessionUser(user: PublicUser): SessionUser {
  return { id: user.id, name: user.name, role: user.role };
}

async function issueTokens(
  user: SessionUser,
  existingRefreshToken?: { token: string; expiresAt: Date }
): Promise<SessionToken> {
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
  tokens: SessionToken;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthenticatedSession> {
    const user = toSessionUser(
      await userService.verifyCredentials(credentials),
    );

    // Higiene: cada login aprovecha para borrar los tokens ya vencidos.
    await refreshTokenRepository.deleteStaleForUser(user.id);

    return { user, tokens: await issueTokens(user) };
  },
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;

    const stored = await refreshTokenRepository.findByHash(
      hashToken(rawRefreshToken),
    );

    if (stored) {
      await refreshTokenRepository.revoke(stored.id);
    }
  },
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
    if (stored.revokeAt) {
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
    if (secondsLeft > REFRESH_ROTATE_THRESHOLD_SECONDS) {
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
};
