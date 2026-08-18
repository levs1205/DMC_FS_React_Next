import { pool } from "@/lib/db/pool";
import type { UserRecord } from "./user.types";

export const userRepository = {


  async findByLogin(login: string): Promise<UserRecord | null> {
    const query = 'SELECT id, "name", login, "password" FROM public."user" WHERE login = $1';
    const result = await pool.query<UserRecord>(query, [login]);
    return result.rows[0] ?? null;
  },

  async findAll(): Promise<UserRecord[]> {
    const query = 'SELECT id, "name", login, "password" FROM public."user"';
    const result = await pool.query<UserRecord>(query);
    return result.rows;
  }

}
