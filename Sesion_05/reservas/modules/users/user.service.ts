import { userRepository } from "@/modules/users/user.repository";
import type { UserLogin, UserPublic, UserRecord } from "@/modules/users/user.types";
import { ApiError } from "@/lib/http/api-error";


function toUserPublic(user: UserRecord): UserPublic {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
  };
}

export const userService = {

  async listUsers(): Promise<UserPublic[]> {
    const users: UserRecord[] = await userRepository.findAll();
    return users.map(toUserPublic);
  },

  async login({user,password} : UserLogin): Promise<UserPublic>{
    
    if(!user || !password){
        throw new ApiError('Los campos user y password son obligatorios', 400)
    }

    const record = await userRepository.findByLogin(user);

    if (!record || record.password !== password){
        throw new ApiError("usuario incorrecto",401)
    }

    return toUserPublic(record);

  }

}