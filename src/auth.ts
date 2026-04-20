import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { env, features } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";
import type { Role } from "@/generated/prisma/client";
import authConfig from "./auth.config";

/**
 * Extend NextAuth Session / JWT types with our custom fields.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

const providers = [];

if (features.googleOAuth) {
  providers.push(
    Google({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (features.githubOAuth) {
  providers.push(
    GitHub({
      clientId: env.GITHUB_CLIENT_ID!,
      clientSecret: env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

// Credentials provider (email + password)
providers.push(
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      turnstileToken: { label: "Turnstile", type: "text" },
    },
    async authorize(raw) {
      const email =
        typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
      const password = typeof raw?.password === "string" ? raw.password : "";
      const turnstileToken =
        typeof raw?.turnstileToken === "string" ? raw.turnstileToken : "";

      if (!email || !password) return null;

      if (features.turnstile) {
        const ok = await verifyTurnstile(turnstileToken);
        if (!ok) throw new Error("CAPTCHA_FAILED");
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) return null;
      if (!user.isActive) throw new Error("ACCOUNT_DISABLED");
      if (features.email && !user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return null;

      await prisma.studentProfile
        .update({
          where: { userId: user.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {
          /* not a student — fine */
        });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
    },
  })
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // Prisma v7 emits a slightly different client type than @auth/prisma-adapter
  // expects. Runtime is compatible; the cast silences a type mismatch.
  // eslint-disable-next-line
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" }, // JWT required for Edge middleware compatibility
  secret: env.AUTH_SECRET,
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in: `user` is populated. Cache id + role in JWT.
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "STUDENT";
      }
      // On session update trigger, refresh role from DB.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true },
        });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.role = token.role ?? "STUDENT";
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Default new OAuth users to STUDENT role + create student profile.
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "STUDENT" },
      });
      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          displayName: user.name ?? (user.email ? user.email.split("@")[0] : "Student"),
        },
      });
    },
  },
});
