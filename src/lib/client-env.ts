/**
 * Client-exposed environment variables.
 *
 * Safe to import from both client and server. Only contains NEXT_PUBLIC_*
 * values that Next.js inlines at build time.
 */

export const clientEnv = {
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
};

export const clientFeatures = {
  turnstile: Boolean(clientEnv.turnstileSiteKey),
};
