import { pool } from "@/lib/db/pool";
import type { UserRecord } from "@/modules/users/user.types";

export const userRepository = {
  async findAll(): Promise<UserRecord[]> {
    const result = await pool.query<UserRecord>(
      'SELECT id, name, login, password FROM public."user" ORDER BY id'
    );
    return result.rows;
  },

  async findByLogin(login: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRecord>(
      'SELECT id, name, login, password FROM public."user" WHERE login = $1',
      [login]
    );
    return result.rows[0] ?? null;
  },
};
