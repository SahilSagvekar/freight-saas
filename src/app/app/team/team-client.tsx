"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { PERMISSIONS, type Permission } from "@/lib/domain";
import type { ActionResult } from "@/server/booking-actions";
import {
  addMemberAction,
  changeRoleAction,
  createRoleAction,
  deleteRoleAction,
  resetLinkAction,
  setActiveAction,
  updateRoleAction,
  type InviteResult,
} from "@/server/team-actions";

type RoleOption = { id: string; name: string };
type Member = { membershipId: string; userId: string; name: string; email: string; roleId: string; status: string };
type RoleRow = RoleOption & { permissions: Permission[]; isSystem: boolean; members: number };

function useTeamAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(fn: () => Promise<ActionResult<T>>, after?: (data?: T) => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      after?.(res.data);
      router.refresh();
    });
  return { pending, error, run };
}

/** The one-time link. It is shown here and nowhere else, so the owner has to pass it on. */
function LinkBox({ invite, onClose }: { invite: InviteResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
    } catch {
      /* The text is selectable below, so copying by hand still works. */
    }
  };
  return (
    <Alert tone="success" title={invite.emailed ? `Emailed ${invite.name}` : `Sign-in link for ${invite.name}`}>
      <p>
        {invite.emailed ? `We emailed ${invite.email}. ` : `Send this to ${invite.email}. `}
        The link works once and expires in 3 days. It will not be shown again.
      </p>
      <div className="mt-2 flex gap-2">
        <Input readOnly value={invite.link} aria-label="One-time sign-in link" onFocus={(e) => e.currentTarget.select()} className="h-9 font-mono text-xs" />
        <Button type="button" size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </Alert>
  );
}

export function NewMemberCard({ roles }: { roles: RoleOption[] }) {
  const { pending, error, run } = useTeamAction();
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const defaultRole = roles.find((r) => r.name === "Booking agent")?.id ?? roles[0]?.id;
  return (
    <Card>
      <CardHeader title="Add a person" description="They choose their own password from a one-time link. You never see it." />
      <CardBody className="space-y-4">
        {invite && <LinkBox invite={invite} onClose={() => setInvite(null)} />}
        {error && <Alert tone="error">{error}</Alert>}
        <form
          ref={formRef}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_12rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            run(() => addMemberAction(data), (d) => {
              if (d) setInvite(d);
              formRef.current?.reset();
            });
          }}
        >
          <Field label="Name" htmlFor="m-name"><Input id="m-name" name="name" required maxLength={80} autoComplete="off" /></Field>
          <Field label="Email" htmlFor="m-email"><Input id="m-email" name="email" type="email" required autoComplete="off" /></Field>
          <Field label="Role" htmlFor="m-role">
            <Select id="m-role" name="roleId" defaultValue={defaultRole}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add person"}</Button>
        </form>
      </CardBody>
    </Card>
  );
}

function MemberRow({ m, roles, isMe, onInvite }: { m: Member; roles: RoleOption[]; isMe: boolean; onInvite: (i: InviteResult) => void }) {
  const { pending, error, run } = useTeamAction();
  const active = m.status === "active";
  return (
    <Tr>
      <Td>
        <span className="font-medium">{m.name}</span>{isMe && <span className="ml-2 text-xs text-muted">(you)</span>}
        <span className="block text-xs text-muted">{m.email}</span>
        {error && <span className="block text-xs text-danger-600" role="alert">{error}</span>}
      </Td>
      <Td>
        <Select aria-label={`Role for ${m.name}`} value={m.roleId} disabled={pending || !active} className="h-9 w-44" onChange={(e) => run(() => changeRoleAction(m.membershipId, e.target.value))}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Td>
      <Td>{active ? <Badge tone="ok">Active</Badge> : <Badge>Deactivated</Badge>}</Td>
      <Td className="text-right">
        <div className="flex justify-end gap-2">
          {active && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => resetLinkAction(m.membershipId), (d) => d && onInvite(d))}>
              <KeyRound className="size-4" aria-hidden />Sign-in link
            </Button>
          )}
          {!isMe && (
            <Button size="sm" variant={active ? "ghost" : "secondary"} disabled={pending} onClick={() => run(() => setActiveAction(m.membershipId, !active))}>
              {active ? "Deactivate" : "Reactivate"}
            </Button>
          )}
        </div>
      </Td>
    </Tr>
  );
}

export function MembersCard({ members, roles, meId }: { members: Member[]; roles: RoleOption[]; meId: string }) {
  const [invite, setInvite] = useState<InviteResult | null>(null);
  return (
    <Card>
      <CardHeader title="Everyone on your team" description="Deactivating someone signs them out on their next click. Their past bookings stay." />
      {invite && <div className="border-b border-line p-4"><LinkBox invite={invite} onClose={() => setInvite(null)} /></div>}
      <Table>
        <thead><tr><Th>Person</Th><Th>Role</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
        <tbody>{members.map((m) => <MemberRow key={m.membershipId} m={m} roles={roles} isMe={m.userId === meId} onInvite={setInvite} />)}</tbody>
      </Table>
    </Card>
  );
}

function PermissionBoxes({ selected, disabled }: { selected: Permission[]; disabled?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
        <Checkbox key={p} name="permissions" value={p} label={PERMISSIONS[p]} defaultChecked={selected.includes(p)} disabled={disabled} />
      ))}
    </div>
  );
}

function RoleEditor({ role }: { role: RoleRow }) {
  const { pending, error, run } = useTeamAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-3 border-b border-line p-5 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setSaved(false);
        run(() => updateRoleAction(role.id, data), () => setSaved(true));
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{role.name} <span className="text-sm font-normal text-muted">· {role.members} {role.members === 1 ? "person" : "people"}</span></h3>
        {role.isSystem && <Badge tone="brand">Always everything</Badge>}
      </div>
      <PermissionBoxes selected={role.permissions} disabled={role.isSystem} />
      {error && <Alert tone="error">{error}</Alert>}
      {!role.isSystem && (
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save permissions"}</Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending || role.members > 0} title={role.members > 0 ? "Move everyone off this role first" : undefined} onClick={() => run(() => deleteRoleAction(role.id))}>Delete role</Button>
          {saved && !error && <span className="text-sm text-ok-700">Saved</span>}
        </div>
      )}
    </form>
  );
}

export function RolesCard({ roles }: { roles: RoleRow[] }) {
  const { pending, error, run } = useTeamAction();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Card>
      <CardHeader title="Roles" description="A role is a set of permissions. Each role gets its own home screen and menu automatically." />
      {roles.map((r) => <RoleEditor key={`${r.id}:${r.permissions.join()}`} role={r} />)}
      <form
        ref={formRef}
        className="space-y-3 bg-canvas/50 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          run(() => createRoleAction(data), () => formRef.current?.reset());
        }}
      >
        <h3 className="font-medium">New role</h3>
        <Field label="Role name" htmlFor="role-name"><Input id="role-name" name="name" required minLength={2} maxLength={40} placeholder="e.g. Gate supervisor" /></Field>
        <PermissionBoxes selected={["booking.view"]} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create role"}</Button>
      </form>
    </Card>
  );
}
