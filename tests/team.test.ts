import { afterAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "@/db";
import { authenticate } from "@/server/credentials";
import { applySetupToken, issueSetupLink } from "@/server/setup-links";
import { addMember, changeMemberRole, createRole, deleteRole, listTeam, setMemberActive, updateRolePermissions } from "@/server/team";
import { makeTenant } from "./helpers";

afterAll(closeDb);

const actor = (t: { tenantId: string; ownerUserId: string }) => ({ tenantId: t.tenantId, actorId: t.ownerUserId });
const roleId = async (tenantId: string, name: string) => (await adminDb().role.findFirstOrThrow({ where: { tenantId, name } })).id;

describe("team", () => {
  it("adds a person who can only sign in after choosing a password from their link", async () => {
    const t = await makeTenant("Team");
    const { userId } = await addMember(actor(t), { name: "Dana Dock", email: "Dana@Example.test", roleId: await roleId(t.tenantId, "Dock crew") });
    expect(await authenticate("dana@example.test", "anything-at-all-1")).toBeNull();

    const token = new URL(await issueSetupLink(userId, "https://x.test")).searchParams.get("token")!;
    expect(await applySetupToken(token, "dana-picked-this-one")).toMatchObject({ ok: true });
    expect(await authenticate("dana@example.test", "dana-picked-this-one")).toMatchObject({ uid: userId, tid: t.tenantId });
  });

  it("refuses an email that already has an account, in this or any other operator", async () => {
    const a = await makeTenant("Team");
    const b = await makeTenant("Team");
    await expect(addMember(actor(a), { name: "Copy", email: b.email, roleId: await roleId(a.tenantId, "Cashier") })).rejects.toThrow(/already has an account/);
  });

  it("will not use a role that belongs to another operator", async () => {
    const a = await makeTenant("Team");
    const b = await makeTenant("Team");
    await expect(addMember(actor(a), { name: "X", email: "x@example.test", roleId: await roleId(b.tenantId, "Owner") })).rejects.toThrow(/doesn't exist/);
  });

  it("cannot touch another operator's people", async () => {
    const a = await makeTenant("Team");
    const b = await makeTenant("Team");
    const theirs = (await listTeam(b.tenantId)).members[0]!;
    await expect(setMemberActive(actor(a), theirs.membershipId, false)).rejects.toThrow(/isn't on your team/);
    await expect(changeMemberRole(actor(a), theirs.membershipId, await roleId(a.tenantId, "Cashier"))).rejects.toThrow(/isn't on your team/);
  });

  it("always leaves someone able to manage the team", async () => {
    const t = await makeTenant("Team");
    const owner = (await listTeam(t.tenantId)).members[0]!;
    const manager = await roleId(t.tenantId, "Manager");

    await expect(changeMemberRole(actor(t), owner.membershipId, manager)).rejects.toThrow(/nobody able to manage/);
    await expect(setMemberActive({ tenantId: t.tenantId, actorId: "someone-else" }, owner.membershipId, false)).rejects.toThrow(/nobody able to manage/);
    // Rolled back: the owner is unchanged.
    expect((await listTeam(t.tenantId)).members[0]).toMatchObject({ roleName: "Owner", status: "active" });
  });

  it("does not let you deactivate yourself", async () => {
    const t = await makeTenant("Team");
    const me = (await listTeam(t.tenantId)).members[0]!;
    await expect(setMemberActive(actor(t), me.membershipId, false)).rejects.toThrow(/deactivate yourself/);
  });

  it("deactivated people cannot sign in, and can be brought back", async () => {
    const t = await makeTenant("Team");
    const { userId, membershipId } = await addMember(actor(t), { name: "Sam", email: "sam@example.test", roleId: await roleId(t.tenantId, "Cashier") });
    const token = new URL(await issueSetupLink(userId, "https://x.test")).searchParams.get("token")!;
    await applySetupToken(token, "sam-has-a-password");
    await setMemberActive(actor(t), membershipId, false);
    expect(await authenticate("sam@example.test", "sam-has-a-password")).toBeNull();
    await setMemberActive(actor(t), membershipId, true);
    expect(await authenticate("sam@example.test", "sam-has-a-password")).not.toBeNull();
  });

  it("creates, edits and deletes custom roles, but not the Owner role", async () => {
    const t = await makeTenant("Team");
    await createRole(actor(t), { name: "Gate supervisor", permissions: ["booking.view", "manifest.update", "not-a-permission"] });
    await expect(createRole(actor(t), { name: "gate SUPERVISOR", permissions: [] })).rejects.toThrow(/already exists/);

    const { roles } = await listTeam(t.tenantId);
    const gate = roles.find((r) => r.name === "Gate supervisor")!;
    expect(gate.permissions).toEqual(["booking.view", "manifest.update"]);

    await updateRolePermissions(actor(t), gate.id, ["booking.view"]);
    expect((await listTeam(t.tenantId)).roles.find((r) => r.id === gate.id)!.permissions).toEqual(["booking.view"]);

    await expect(updateRolePermissions(actor(t), roles.find((r) => r.name === "Owner")!.id, [])).rejects.toThrow(/always has every permission/);
    await deleteRole(actor(t), gate.id);
    await expect(deleteRole(actor(t), roles.find((r) => r.name === "Owner")!.id)).rejects.toThrow(/can't be deleted/);
  });

  it("will not delete a role that people still hold", async () => {
    const t = await makeTenant("Team");
    const cashier = await roleId(t.tenantId, "Cashier");
    await addMember(actor(t), { name: "Sam", email: "sam2@example.test", roleId: cashier });
    await expect(deleteRole(actor(t), cashier)).rejects.toThrow(/Move everyone off/);
  });
});
