import type { NextAuthConfig } from "next-auth";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

/**
 * Edge-compatible NextAuth config used by `middleware.ts`.
 *
 * MUST NOT import anything that pulls in Node-only APIs (Prisma client,
 * bcrypt, etc.). The providers list is only used for naming; actual
 * authorize / OAuth flows are defined in `src/auth.ts` (Node runtime).
 *
 * Session strategy is JWT so middleware can verify tokens without DB access.
 *
 * The `jwt` and `session` callbacks here mirror those in `src/auth.ts` so
 * that middleware sees the same `session.user.role` as server components.
 */
export default {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: Role }).role ?? "STUDENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      session.user.role = (token.role as Role) ?? "STUDENT";
      return session;
    },
  },
} satisfies NextAuthConfig;
