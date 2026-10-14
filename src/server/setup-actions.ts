"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { applySetupToken } from "./setup-links";

export type SetPasswordState = { error?: string };

/** Sets the password for whoever the one-time link was issued to, then sends them to sign in. */
export async function setPasswordAction(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "The two passwords don't match." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`set-password:${ip}`, 10, 15 * 60 * 1000);
  if (!limited.allowed) return { error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s).` };

  const result = await applySetupToken(token, password);
  if (!result.ok) return { error: result.error };
  redirect("/login?set=1");
}
