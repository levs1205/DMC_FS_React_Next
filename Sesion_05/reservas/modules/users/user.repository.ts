import { prisma } from "@/lib/db/prisma";
import type { UserRecord } from "./user.types";

export const userRepository = {
  async findByLogin(login: string): Promise<UserRecord | null> {
    return prisma.user.findFirst({ where: { login } });
  },

  async findAll(): Promise<UserRecord[]> {
    return prisma.user.findMany({ orderBy: { id: "asc" } });
  },
};
