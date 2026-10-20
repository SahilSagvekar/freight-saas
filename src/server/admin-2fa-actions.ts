"use server";

import { redirect } from "next/navigation";
import { verifyTotp } from "@/lib/totp";
import { adminTotpSecret, adminTwoFactorProblem, issueAdminTwoFactorCookie } from "./admin-2fa";
import { requirePlatformAdminPassword } from "./admin";
import { throttle } from "./throttle";

export type AdminCodeState = { error?: string };

/** Checks the 6-digit code from the authenticator app and, if it is right, opens the console for 12 hours. */
export async function verifyAdminCodeAction(_prev: AdminCodeState, formData: FormData): Promise<AdminCodeState> {
  const auth = await requirePlatformAdminPassword();
  if (adminTwoFactorProblem()) return { error: "Two-factor sign-in isn't set up on this server." };

  // Only 5 guesses per 15 minutes per person: a 6-digit code is only safe if guessing is slow.
  const limited = await throttle(`admin-2fa:${auth.userId}`, 5, 15 * 60 * 1000);
  if (!limited.allowed) return { error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s).` };

  const secret = adminTotpSecret();
  if (!secret || !verifyTotp(secret, String(formData.get("code") ?? ""))) return { error: "That code isn't right. Check your authenticator app and try again." };

  await issueAdminTwoFactorCookie(auth.userId);
  redirect("/admin");
}
