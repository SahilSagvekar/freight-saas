import { adminDb } from "@/db";
import { hashPassword, passwordProblem } from "@/lib/password";
import { passwordFingerprint, SETUP_LINK_TTL_HOURS, signSetupToken, verifySetupToken } from "@/lib/tokens";

/**
 * Everything here runs on the admin connection: people choose their password before any tenant is known,
 * and the app role is not allowed to touch users.password_hash.
 */

/** A one-time link that lets `userId` choose a password. Works once, and expires after `ttlHours`. */
export async function issueSetupLink(userId: string, baseUrl: string, ttlHours = SETUP_LINK_TTL_HOURS): Promise<string> {
  const user = await adminDb().user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new Error("User not found");
  const token = await signSetupToken({ uid: userId, fp: passwordFingerprint(user.passwordHash) }, ttlHours);
  return `${baseUrl.replace(/\/+$/, "")}/set-password?token=${encodeURIComponent(token)}`;
}

async function loadTarget(token: string | null | undefined) {
  const claims = await verifySetupToken(token);
  if (!claims) return null;
  const user = await adminDb().user.findUnique({
    where: { id: claims.uid },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
  if (!user || passwordFingerprint(user.passwordHash) !== claims.fp) return null;
  return user;
}

/** Who a setup link is for, or null when it is invalid, expired or already used. */
export async function describeSetupToken(token: string | null | undefined): Promise<{ name: string; email: string } | null> {
  const user = await loadTarget(token);
  return user ? { name: user.name, email: user.email } : null;
}

export type SetPasswordResult = { ok: true; email: string } | { ok: false; error: string };

export async function applySetupToken(token: string, password: string): Promise<SetPasswordResult> {
  const problem = passwordProblem(password);
  if (problem) return { ok: false, error: problem };

  const user = await loadTarget(token);
  if (!user) return { ok: false, error: "This link has expired or was already used. Ask your administrator for a new one." };

  // The old hash is part of the WHERE clause, so two people opening the same link at the same moment cannot both win.
  const changed = await adminDb().user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: { passwordHash: await hashPassword(password) },
  });
  if (changed.count === 0) return { ok: false, error: "This link was already used. Ask your administrator for a new one." };
  return { ok: true, email: user.email };
}
