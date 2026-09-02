import { ApiError } from "@/lib/http/api-error"
import { createHash } from "node:crypto"
import type { SessionToken, SessionUser } from "@/modules/auth/auth.types"
import type { LoginCredentials, PublicUser } from "@/modules/users/user.types"
import { refreshTokenRepository } from "@/modules/auth/refresh.token.repository"


function hashToken(token: string): string{
    return createHash("sha256").update(token).digest("hex");
}

export const authService = {
    async logout(rawRefreshToken: string | undefined) : Promise<void>{
        if(!rawRefreshToken) return;

        const stored = await refreshTokenRepository.findByHash(
            hashToken(rawRefreshToken)
        );

        if(stored){
            await refreshTokenRepository.revoke(stored.id);
        }
    }
}