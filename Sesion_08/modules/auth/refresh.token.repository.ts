import { prisma } from "@/lib/db/prisma";

export interface RefreshTokenRecord {
  id: number;
  tokenHash: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export const refreshTokenRepository = {
  async create(data: {
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    return prisma.refreshToken.create({ data });
  },
};
