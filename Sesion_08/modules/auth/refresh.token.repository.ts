import { prisma } from "@/lib/db/prisma";

export interface RefreshTokenRecord {
  id: number;
  tokenHash: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  revokeAt: Date | null;
}

export const refreshTokenRepository = {
  async create(data: {
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    return prisma.refreshToken.create({ data });
  },

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  async revoke(id: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { id, revokeAt: null },
      data: { revokeAt: new Date() },
    });
  },

  async revokeAllForUser(userId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokeAt: null },
      data: { revokeAt: new Date() },
    });
  },

  async deleteStaleForUser(userId: number): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  },
};
