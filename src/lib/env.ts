import { z } from "zod";

/**
 * Server-side environment variables.
 * Missing/invalid values cause the build to fail fast.
 *
 * NEVER import this file from client components — it references secrets.
 */
const serverSchema = z.object({
  // ── NextAuth ────────────────────────────────────────
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be ≥ 32 chars (openssl rand -base64 32)"),
  AUTH_URL: z.string().url().optional(), // Vercel auto-injects VERCEL_URL

  // ── OAuth Providers ────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  // ── Cloudflare Turnstile (server-side secret) ──────
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),

  // ── Email (Resend) ─────────────────────────────────
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  EMAIL_FROM: z.string().email().optional(),

  // ── LLM ────────────────────────────────────────────
  LLM_API_KEY: z.string().min(1),

  // ── Database ───────────────────────────────────────
  DATABASE_URL: z.string().startsWith("postgresql://"),

  // ── Legacy (to remove after full migration) ────────
  JWT_SECRET: z.string().min(1).optional(),
});

/**
 * Client-exposed environment variables.
 * Only variables prefixed with NEXT_PUBLIC_ are included in the client bundle.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

function parseEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid server environment variables:");
    console.error(parsed.error.format());
    throw new Error("Environment validation failed. See logs above.");
  }
  return parsed.data;
}

function parseClientEnv() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  });
  if (!parsed.success) {
    console.error("❌ Invalid client environment variables:");
    console.error(parsed.error.format());
    throw new Error("Client environment validation failed.");
  }
  return parsed.data;
}

export const env = parseEnv();
export const clientEnv = parseClientEnv();

/**
 * Feature flags derived from presence of credentials.
 * Keeps callers from importing env directly for boolean checks.
 */
export const features = {
  googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  githubOAuth: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  turnstile: Boolean(env.TURNSTILE_SECRET_KEY && clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
};
