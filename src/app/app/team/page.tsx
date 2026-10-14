import { PageHeader } from "@/components/ui/page";
import { requirePermission } from "@/server/auth";
import { listTeam } from "@/server/team";
import { MembersCard, NewMemberCard, RolesCard } from "./team-client";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const auth = await requirePermission("team.manage");
  const { members, roles } = await listTeam(auth.tenantId);
  return (
    <>
      <PageHeader title="Team" description="Add people, choose what each role can do, and share sign-in links." />
      <div className="space-y-6">
        <NewMemberCard roles={roles.map((r) => ({ id: r.id, name: r.name }))} />
        <MembersCard
          meId={auth.userId}
          members={members.map((m) => ({ membershipId: m.membershipId, userId: m.userId, name: m.name, email: m.email, roleId: m.roleId, status: m.status }))}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        />
        <RolesCard roles={roles} />
      </div>
    </>
  );
}
