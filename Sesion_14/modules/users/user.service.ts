import { ApiError } from "@/lib/http/api-error";
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
   * Comprueba usuario y contraseña. Devuelve siempre el mismo error 401 para
   * "el usuario no existe" y "la contraseña no coincide": distinguirlos le
   * permitiría a un atacante averiguar qué correos están registrados.
   */
  async verifyCredentials({
    user,
    password,
  }: LoginCredentials): Promise<PublicUser> {
    const record = await userRepository.findByLogin(user);

    if (!record || record.password !== password) {
      throw new ApiError(401, "Usuario o contraseña incorrectos.");
    }

    return toPublicUser(record);
  },
};
