import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth config used by `middleware.ts`.
 *
 * MUST NOT import anything that pulls in Node-only APIs (Prisma client,
 * bcrypt, etc.). The providers list is only used for naming; actual
 * authorize / OAuth flows are defined in `src/auth.ts` (Node runtime).
 *
 * Session strategy is JWT so middleware can verify tokens without DB access.
 */
export default {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig;
