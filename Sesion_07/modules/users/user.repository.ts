import { prisma } from "@/lib/db/prisma";
import type { UserRecord } from "@/modules/users/user.types";

export const userRepository = {
  async findAll(): Promise<UserRecord[]> {
    return prisma.user.findMany({ orderBy: { id: "asc" } });
  },

  async findByLogin(login: string): Promise<UserRecord | null> {
    return prisma.user.findFirst({ where: { login } });
  },
};
