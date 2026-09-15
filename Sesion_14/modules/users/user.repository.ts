import { prisma } from "@/lib/db/prisma";
import type { UserRole } from "@/modules/auth/auth.types";
import type { UserRecord } from "@/modules/users/user.types";

export const userRepository = {
  async findAll(): Promise<UserRecord[]> {
    return prisma.user.findMany({ orderBy: { id: "asc" } });
  },

  async findById(id: number): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  // `findUnique` y no `findFirst`: desde que "login" tiene índice único, la
  // consulta va por el índice y —lo que importa más— el tipo expresa la
  // invariante. `findFirst` decía "devuelvo una de las que haya", que es
  // exactamente lo que no queremos de una búsqueda de credenciales.
  async findByLogin(login: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({ where: { login } });
  },

  // Solo el rol: es lo único que necesitan las guardias de sesión, así que se
  // pide esa columna y nada más en vez de traer la fila completa.
  async findRoleById(id: number): Promise<UserRole | null> {
    const record = await prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    return record?.role ?? null;
  },
};
