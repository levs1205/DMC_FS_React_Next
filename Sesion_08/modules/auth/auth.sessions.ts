import { cache} from "react"
import { redirect } from "next/navigation"
import { ApiError } from "@/lib/http/api-error"
import {
    LOGIN_PATH,
    homePathForRole

} from "@/modules/auth/auth.config"
import { readSessionCookies } from "@/modules/auth/auth.cookies"
import type { SessionIdentity, SessionUser, UserRole } from "@/modules/auth/auth.types"
import { userService } from "@/modules/users/user.service"

export const getSession = cache(
    async(): Promise<SessionIdentity | null> => {
        const { accessToken } = await readSessionCookies();

        if(!accessToken) return null;

        
    }
);


// export async function requireRole(
//     ...roles: readonly UserRole[]
// ): Promise<SessionUser>{
//     const session = await getSessionUser


// }