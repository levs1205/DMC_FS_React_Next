import type { UserRole } from "@/lib/generated/prisma/enums"

export type { UserRole }

export const USER_ROLES = ["STUDENT", "ADMIN"] as const satisfies readonly UserRole[]

export function isUserRole(value: unknown): value is UserRole{
    return USER_ROLES.includes(value as UserRole)
}

export interface SessionIdentity {
    id: number,
    name: string | null,
}

export interface SessionUser extends SessionIdentity{
    role: UserRole
}

export interface SessionToken {
    accessToken: string,
    refreshToken: string,
    refreshTokenExpireAt: Date
}