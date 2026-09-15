import { ApiError } from "@/lib/http/api-error";
import {
  fakeVerifyPassword,
  verifyPassword,
} from "@/modules/auth/auth.password";
import type { UserRole } from "@/modules/auth/auth.types";
import { userRepository } from "@/modules/users/user.repository";
import type {
  LoginCredentials,
  PublicUser,
  UserRecord,
} from "@/modules/users/user.types";

function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    name: record.name,
    login: record.login,
    role: record.role,
  };
}

export const userService = {
  async listUsers(): Promise<PublicUser[]> {
    const users = await userRepository.findAll();
    return users.map(toPublicUser);
  },

  async findById(id: number): Promise<PublicUser | null> {
    const record = await userRepository.findById(id);
    return record ? toPublicUser(record) : null;
  },

  /**
   * Rol vigente del usuario, leído de la base a partir de su id. Las guardias
   * de sesión lo usan para autorizar: el rol ya no viaja dentro del access
   * token. Devuelve null si el usuario ya no existe.
   */
  async findRoleById(id: number): Promise<UserRole | null> {
    return userRepository.findRoleById(id);
  },

  /**
   * Comprueba usuario y contraseña.
   *
   * Devuelve siempre el mismo error 401 para "el usuario no existe" y "la
   * contraseña no coincide": distinguirlos le permitiría a un atacante
   * averiguar qué correos están registrados.
   *
   * Y no basta con que el mensaje sea el mismo, también tiene que tardar lo
   * mismo. Por eso, cuando el usuario no existe, se calcula igualmente un hash
   * descartable (`fakeVerifyPassword`): sin eso, un correo desconocido
   * respondería en 2 ms y uno registrado en 100 ms, y esa diferencia se mide
   * desde fuera sin ninguna dificultad.
   */
  async verifyCredentials({
    user,
    password,
  }: LoginCredentials): Promise<PublicUser> {
    const record = await userRepository.findByLogin(user);

    if (!record) {
      await fakeVerifyPassword(password);
      throw new ApiError(401, "Usuario o contraseña incorrectos.");
    }

    // Una fila cuya contraseña siga en texto plano no entra: `verifyPassword`
    // solo acepta el formato con hash. Falla cerrado a propósito.
    if (!(await verifyPassword(password, record.password))) {
      throw new ApiError(401, "Usuario o contraseña incorrectos.");
    }

    return toPublicUser(record);
  },
};
