import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Single-use token utilities built on top of the VerificationToken table
 * (shared with NextAuth; scoped per purpose via an identifier prefix).
 *
 * Tokens are stored hashed (SHA-256) so leaking the DB does not leak usable
 * links. We return the plaintext token once to embed in the email link.
 */

const VERIFY_PREFIX = "verify-email:";
const RESET_PREFIX = "reset-password:";

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createToken(
  identifier: string,
  ttlMs: number
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + ttlMs);

  // Delete any prior token for this identifier to keep it single-use.
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  await prisma.verificationToken.create({
    data: { identifier, token: hash(token), expires },
  });

  return token;
}

async function consumeToken(
  identifier: string,
  token: string
): Promise<boolean> {
  const row = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: hash(token) } },
  });
  if (!row) return false;
  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier, token: hash(token) } },
    });
    return false;
  }
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier, token: hash(token) } },
  });
  return true;
}

export async function createVerifyEmailToken(email: string): Promise<string> {
  return createToken(`${VERIFY_PREFIX}${email.toLowerCase()}`, 24 * 60 * 60 * 1000);
}

export async function consumeVerifyEmailToken(
  email: string,
  token: string
): Promise<boolean> {
  return consumeToken(`${VERIFY_PREFIX}${email.toLowerCase()}`, token);
}

export async function createResetPasswordToken(email: string): Promise<string> {
  return createToken(`${RESET_PREFIX}${email.toLowerCase()}`, 60 * 60 * 1000);
}

export async function consumeResetPasswordToken(
  email: string,
  token: string
): Promise<boolean> {
  return consumeToken(`${RESET_PREFIX}${email.toLowerCase()}`, token);
}
