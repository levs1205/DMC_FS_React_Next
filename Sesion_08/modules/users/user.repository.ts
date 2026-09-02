import { prisma } from "@/lib/db/prisma";
import type { UserRecord } from "@/modules/users/user.types";
import type { UserRole } from "@/modules/auth/auth.types";


export const userRepository = {
  async findAll(): Promise<UserRecord[]> {
    return prisma.user.findMany({ orderBy: { id: "asc" } });
  },

  async findByLogin(login: string): Promise<UserRecord | null> {
    return prisma.user.findFirst({ where: { login } });
  },

  async findRoleById(id:number): Promise<UserRole| null>{
    const record = await prisma.user.findUnique(
      {
        where: {id},
        select : { role: true}
      }
    );

    return record?.role ?? null;
  }

};
