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

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  async revoke(id: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // Se usa ante una sospecha de robo: se cierran todas las sesiones del usuario.
  async revokeAllForUser(userId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // Limpieza de filas que ya no sirven (tokens vencidos o revocados hace rato).
  async deleteStaleForUser(userId: number): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  },
};
