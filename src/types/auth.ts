/**
 * Auth-related shared types.
 *
 * NextAuth Session / User types are augmented via `declare module "next-auth"`
 * in `src/auth.ts`. Import `{ Session } from "next-auth"` anywhere you need
 * session types.
 */

export type { Role } from "@/generated/prisma/client";
