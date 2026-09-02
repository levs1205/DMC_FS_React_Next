import { ApiError } from "@/lib/http/api-error";
import { userRepository } from "@/modules/users/user.repository";
import type {
  LoginCredentials,
  PublicUser,
  UserRecord,
} from "@/modules/users/user.types";
import { UserRole } from "../auth/auth.types";

function toPublicUser(record: UserRecord): PublicUser {
  return { id: record.id, name: record.name, login: record.login };
}

export const userService = {
  async listUsers(): Promise<PublicUser[]> {
    const users = await userRepository.findAll();
    return users.map(toPublicUser);
  },

  async login({ user, password }: LoginCredentials): Promise<PublicUser> {
    if (!user || !password) {
      throw new ApiError(400, 'Los campos "user" y "password" son obligatorios.');
    }

    const record = await userRepository.findByLogin(user);

    if (!record || record.password !== password) {
      throw new ApiError(401, "Usuario o contraseña incorrectos.");
    }

    return toPublicUser(record);
  },

  async findRoleById(id:number): Promise<UserRole | null>{
    return userRepository.findRoleById(id);
  }
};
