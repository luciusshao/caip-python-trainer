export type UserRole = "student" | "teacher";

export interface TokenPayload {
  userId: string;
  role: UserRole;
  mustChangePassword?: boolean; // student only
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  userId: string;
  role: UserRole;
}
