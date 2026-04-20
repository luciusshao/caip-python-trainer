import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import type { TokenPayload, UserRole } from "@/types/auth";

// ─── Password helpers ──────────────────────────────────

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT helpers ───────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

const COOKIE_CONFIG = {
  student: { name: "student-token", maxAge: 7 * 24 * 60 * 60 },
  teacher: { name: "teacher-token", maxAge: 7 * 24 * 60 * 60 },
} as const;

export async function signToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
  role: UserRole
): Promise<string> {
  const config = COOKIE_CONFIG[role];
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.maxAge}s`)
    .sign(getJwtSecret());
}

export async function verifyToken(
  token: string,
  expectedRole: UserRole
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const data = payload as unknown as TokenPayload;
    if (data.role !== expectedRole) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ────────────────────────────────────

export function setAuthCookie(
  response: NextResponse,
  token: string,
  role: UserRole
): void {
  const config = COOKIE_CONFIG[role];
  response.cookies.set(config.name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: config.maxAge,
    path: "/",
  });
}

export function clearAuthCookie(
  response: NextResponse,
  role: UserRole
): void {
  const config = COOKIE_CONFIG[role];
  response.cookies.set(config.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function getCookieName(role: UserRole): string {
  return COOKIE_CONFIG[role].name;
}

// ─── Random password generator ─────────────────────────

export function generatePassword(length = 8): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
