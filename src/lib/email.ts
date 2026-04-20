import { Resend } from "resend";
import { env, features } from "@/lib/env";

const resend = features.email ? new Resend(env.RESEND_API_KEY) : null;

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email via Resend. In dev, if RESEND_API_KEY / EMAIL_FROM are not set,
 * the email is logged to console instead (so local flows still complete).
 */
export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  if (!resend) {
    console.log("─── [DEV email, no Resend configured] ───");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html.replace(/<[^>]+>/g, ""));
    console.log("──────────────────────────────────────────");
    return { ok: true, dev: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM!,
      to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[email] Resend error:", error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false, error: err };
  }
}

/**
 * Build an absolute URL for an auth callback (verify, reset) that works both
 * on localhost and on Vercel. Vercel injects VERCEL_URL automatically.
 */
export function getBaseUrl(): string {
  if (env.AUTH_URL) return env.AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3099";
}

// ── Templates ───────────────────────────────────────────────

export function verifyEmailTemplate(link: string): { subject: string; html: string; text: string } {
  return {
    subject: "[CAIP Trainer] Verify your email",
    text: `Welcome to CAIP Python Trainer!\n\nClick the link below to verify your email:\n${link}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #3B0764;">Welcome to CAIP Python Trainer</h2>
        <p>Thanks for signing up. Please verify your email to activate your account:</p>
        <p><a href="${link}" style="display: inline-block; padding: 12px 24px; background: #F5A623; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify email</a></p>
        <p style="color: #999; font-size: 13px;">Or copy this link: <code>${link}</code></p>
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
      </div>
    `,
  };
}

export function resetPasswordTemplate(link: string): { subject: string; html: string; text: string } {
  return {
    subject: "[CAIP Trainer] Reset your password",
    text: `We received a password reset request for your CAIP Trainer account.\n\nClick the link below to set a new password:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #3B0764;">Reset your password</h2>
        <p>Click the link below to set a new password. If you didn't request this, you can safely ignore this email.</p>
        <p><a href="${link}" style="display: inline-block; padding: 12px 24px; background: #F5A623; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset password</a></p>
        <p style="color: #999; font-size: 13px;">Or copy this link: <code>${link}</code></p>
        <p style="color: #999; font-size: 12px;">This link expires in 1 hour.</p>
      </div>
    `,
  };
}
