import { env, features } from "@/lib/env";

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!features.turnstile) {
    // Feature disabled — treat all tokens as valid (dev mode).
    return true;
  }

  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY!,
          response: token,
        }),
      }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] verification error:", err);
    return false;
  }
}
