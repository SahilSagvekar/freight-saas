"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/domain";
import { requirePermission } from "./auth";
import type { ActionResult } from "./booking-actions";
import { appBaseUrl } from "./base-url";
import { BookingError } from "./bookings";
import { issueSetupLink } from "./setup-links";
import { addMember, changeMemberRole, createRole, deleteRole, memberForReset, setMemberActive, updateRolePermissions } from "./team";

async function guarded<T>(fn: (a: { tenantId: string; actorId: string }) => Promise<T>): Promise<ActionResult<T>> {
  const auth = await requirePermission("team.manage");
  try {
    const data = await fn({ tenantId: auth.tenantId, actorId: auth.userId });
    revalidatePath("/app/team");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof BookingError) return { ok: false, error: e.message, fields: e.fields };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const first = (r: { error: z.ZodError }) => r.error.issues[0]?.message ?? "Check the form and try again.";
const uuid = z.string().uuid("Pick a role");
const permissionList = (f: FormData) => f.getAll("permissions").map(String).filter((p) => p in PERMISSIONS);

export type InviteResult = { link: string; name: string; email: string };

/** Adds a person and returns a one-time link for them to choose a password. Shown once; it is not stored. */
export async function addMemberAction(f: FormData): Promise<ActionResult<InviteResult>> {
  const p = z
    .object({ name: z.string().trim().min(1, "Enter their name").max(80), email: z.string().trim().email("Enter a valid email").max(200), roleId: uuid })
    .safeParse({ name: f.get("name"), email: f.get("email"), roleId: f.get("roleId") });
  if (!p.success) return { ok: false, error: first(p) };
  const base = await appBaseUrl();
  return guarded(async (a) => {
    const { userId } = await addMember(a, p.data);
    return { link: await issueSetupLink(userId, base), name: p.data.name, email: p.data.email.toLowerCase() };
  });
}

/** A fresh link for someone who forgot their password or never used the first one. Their current password keeps working until they use it. */
export async function resetLinkAction(membershipId: string): Promise<ActionResult<InviteResult>> {
  if (!uuid.safeParse(membershipId).success) return { ok: false, error: "Unknown person." };
  const base = await appBaseUrl();
  return guarded(async (a) => {
    const who = await memberForReset(a, membershipId);
    return { link: await issueSetupLink(who.userId, base), name: who.name, email: who.email };
  });
}

export async function changeRoleAction(membershipId: string, roleId: string): Promise<ActionResult> {
  if (!uuid.safeParse(membershipId).success || !uuid.safeParse(roleId).success) return { ok: false, error: "Unknown person or role." };
  return guarded((a) => changeMemberRole(a, membershipId, roleId));
}

export async function setActiveAction(membershipId: string, active: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(membershipId).success) return { ok: false, error: "Unknown person." };
  return guarded((a) => setMemberActive(a, membershipId, active));
}

export async function createRoleAction(f: FormData): Promise<ActionResult> {
  const p = z.object({ name: z.string().trim().min(2, "Give the role a name").max(40) }).safeParse({ name: f.get("name") });
  if (!p.success) return { ok: false, error: first(p) };
  return guarded((a) => createRole(a, { name: p.data.name, permissions: permissionList(f) }));
}

export async function updateRoleAction(roleId: string, f: FormData): Promise<ActionResult> {
  if (!uuid.safeParse(roleId).success) return { ok: false, error: "Unknown role." };
  return guarded((a) => updateRolePermissions(a, roleId, permissionList(f)));
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  if (!uuid.safeParse(roleId).success) return { ok: false, error: "Unknown role." };
  return guarded((a) => deleteRole(a, roleId));
}
