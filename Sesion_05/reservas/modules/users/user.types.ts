export interface UserRecord {
  id: number;
  name: string;
  login: string;
  password: string;
}

export type UserPublic = Omit<UserRecord, "password">;

export interface UserLogin {
  user: string;
  password: string;
}