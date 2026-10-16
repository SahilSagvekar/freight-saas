import { randomBytes } from "node:crypto";
import { adminTransaction, withTenant, type Tx } from "@/db";
import { ALL_PERMISSIONS, type Permission } from "@/lib/domain";
import { hashPassword } from "@/lib/password";
import { assertWithinPlan } from "./billing";
import { BookingError } from "./bookings";
import { audit } from "./shared";

/**
 * Team changes run on the admin connection because the app role may not write users. That connection skips
 * row-level security, so every query below names the tenant explicitly and never trusts an id on its own.
 */
type Actor = { tenantId: string; actorId: string };

export type TeamMember = { membershipId: string; userId: string; name: string; email: string; roleId: string; roleName: string; status: string; createdAt: Date };
export type RoleRow = { id: string; name: string; permissions: Permission[]; isSystem: boolean; members: number };

export async function listTeam(tenantId: string): Promise<{ members: TeamMember[]; roles: RoleRow[] }> {
  return withTenant(tenantId, async (tx) => {
    const [memberships, roles] = await Promise.all([
      tx.membership.findMany({
        include: { user: { select: { id: true, name: true, email: true } }, role: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      tx.role.findMany({ orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }] }),
    ]);
    const counts = new Map<string, number>();
    for (const m of memberships) if (m.status === "active") counts.set(m.roleId, (counts.get(m.roleId) ?? 0) + 1);
    return {
      members: memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        roleId: m.role.id,
        roleName: m.role.name,
        status: m.status,
        createdAt: m.createdAt,
      })),
      roles: roles.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions as Permission[], isSystem: r.isSystem, members: counts.get(r.id) ?? 0 })),
    };
  });
}

/** Throws (and so rolls the whole change back) if nobody active could manage the team any more. */
async function assertSomeoneCanManageTeam(tx: Tx, tenantId: string) {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`
    select count(*) as n from memberships m join roles r on r.id = m.role_id
    where m.tenant_id = ${tenantId}::uuid and m.status = 'active' and 'team.manage' = any(r.permissions)`;
  if (Number(rows[0]?.n ?? 0) < 1) {
    throw new BookingError("INVALID", "That would leave nobody able to manage the team. Make someone else an owner first.");
  }
}

async function ownMembership(tx: Tx, tenantId: string, membershipId: string) {
  const m = await tx.membership.findFirst({ where: { id: membershipId, tenantId }, include: { user: { select: { id: true, name: true, email: true } } } });
  if (!m) throw new BookingError("NOT_FOUND", "That person isn't on your team.");
  return m;
}

async function ownRole(tx: Tx, tenantId: string, roleId: string) {
  const r = await tx.role.findFirst({ where: { id: roleId, tenantId } });
  if (!r) throw new BookingError("NOT_FOUND", "That role doesn't exist.");
  return r;
}

export async function addMember(a: Actor, input: { name: string; email: string; roleId: string }): Promise<{ membershipId: string; userId: string }> {
  const email = input.email.trim().toLowerCase();
  const unusable = await hashPassword(randomBytes(32).toString("base64url"));
  return adminTransaction(async (tx) => {
    await ownRole(tx, a.tenantId, input.roleId);
    await assertWithinPlan(tx, a.tenantId, "user");
    const existing = await tx.$queryRaw<{ id: string }[]>`select id from users where lower(email) = ${email}`;
    if (existing.length > 0) {
      // Attaching someone who already has an account would let any owner probe which emails exist. Refused on purpose.
      throw new BookingError("INVALID", "That email already has an account. Ask them to use a different email for this team.", { email: "Already in use" });
    }
    const user = await tx.user.create({ data: { name: input.name.trim(), email, passwordHash: unusable } });
    const m = await tx.membership.create({ data: { tenantId: a.tenantId, userId: user.id, roleId: input.roleId } });
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: "team.add", entity: "membership", entityId: m.id, after: { email, roleId: input.roleId } });
    return { membershipId: m.id, userId: user.id };
  });
}

export async function changeMemberRole(a: Actor, membershipId: string, roleId: string) {
  await adminTransaction(async (tx) => {
    const m = await ownMembership(tx, a.tenantId, membershipId);
    await ownRole(tx, a.tenantId, roleId);
    if (m.roleId === roleId) return;
    await tx.membership.update({ where: { id: m.id }, data: { roleId } });
    await assertSomeoneCanManageTeam(tx, a.tenantId);
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: "team.role", entity: "membership", entityId: m.id, before: { roleId: m.roleId }, after: { roleId } });
  });
}

export async function setMemberActive(a: Actor, membershipId: string, active: boolean) {
  await adminTransaction(async (tx) => {
    const m = await ownMembership(tx, a.tenantId, membershipId);
    if (!active && m.userId === a.actorId) throw new BookingError("INVALID", "You can't deactivate yourself.");
    const status = active ? "active" : "disabled";
    if (m.status === status) return;
    await tx.membership.update({ where: { id: m.id }, data: { status } });
    await assertSomeoneCanManageTeam(tx, a.tenantId);
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: active ? "team.activate" : "team.deactivate", entity: "membership", entityId: m.id, before: { status: m.status }, after: { status } });
  });
}

/** Confirms the membership is on this team and returns who it is, for issuing a reset link. */
export async function memberForReset(a: Actor, membershipId: string) {
  return adminTransaction(async (tx) => {
    const m = await ownMembership(tx, a.tenantId, membershipId);
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: "team.reset-link", entity: "membership", entityId: m.id });
    return { userId: m.user.id, name: m.user.name, email: m.user.email };
  });
}

function cleanPermissions(input: string[]): Permission[] {
  const wanted = new Set(input);
  return ALL_PERMISSIONS.filter((p) => wanted.has(p));
}

export async function createRole(a: Actor, input: { name: string; permissions: string[] }) {
  const name = input.name.trim();
  await adminTransaction(async (tx) => {
    const clash = await tx.role.findFirst({ where: { tenantId: a.tenantId, name: { equals: name, mode: "insensitive" } } });
    if (clash) throw new BookingError("INVALID", "A role with that name already exists.");
    const role = await tx.role.create({ data: { tenantId: a.tenantId, name, permissions: cleanPermissions(input.permissions) } });
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: "role.create", entity: "role", entityId: role.id, after: { name, permissions: role.permissions } });
  });
}

export async function updateRolePermissions(a: Actor, roleId: string, permissions: string[]) {
  await adminTransaction(async (tx) => {
    const role = await ownRole(tx, a.tenantId, roleId);
    if (role.isSystem) throw new BookingError("INVALID", "The Owner role always has every permission.");
    const next = cleanPermissions(permissions);
    await tx.role.update({ where: { id: role.id }, data: { permissions: next } });
    await assertSomeoneCanManageTeam(tx, a.tenantId);
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: "role.update", entity: "role", entityId: role.id, before: { permissions: role.permissions }, after: { permissions: next } });
  });
}

export async function deleteRole(a: Actor, roleId: string) {
  await adminTransaction(async (tx) => {
    const role = await ownRole(tx, a.tenantId, roleId);
    if (role.isSystem) throw new BookingError("INVALID", "The Owner role can't be deleted.");
    const inUse = await tx.membership.count({ where: { tenantId: a.tenantId, roleId } });
    if (inUse > 0) throw new BookingError("INVALID", "Move everyone off this role before deleting it.");
    await tx.role.delete({ where: { id: role.id } });
    await audit(tx, { tenantId: a.tenantId, actorId: a.actorId, action: "role.delete", entity: "role", entityId: role.id, before: { name: role.name } });
  });
}
