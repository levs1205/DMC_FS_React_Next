export interface UserRecord {
  id: number;
  name: string | null;
  login: string | null;
  password: string | null;
}

export type UserPublic = Omit<UserRecord, "password">;

export interface UserLogin {
  user: string;
  password: string;
}