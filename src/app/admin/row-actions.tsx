"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/booking-actions";
import { extendTrialAction, ownerLinkAction, setCompedAction, setTenantStatusAction } from "@/server/admin-actions";

export function AdminRowActions({ tenantId, suspended, comped }: { tenantId: string; suspended: boolean; comped: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult<unknown>>, ok?: (d: unknown) => string) =>
    start(async () => {
      setNote(null);
      const r = await fn();
      if (!r.ok) return setNote(r.error);
      if (ok) setNote(ok(r.data));
      router.refresh();
    });
  const confirmThen = (q: string, fn: () => void) => () => { if (window.confirm(q)) fn(); };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => extendTrialAction(tenantId, 14))}>+14d trial</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={confirmThen(comped ? "Put this operator back on a 14-day trial?" : "Make this operator complimentary (no billing, full access)?", () => run(() => setCompedAction(tenantId, !comped)))}>{comped ? "Un-comp" : "Comp"}</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => ownerLinkAction(tenantId), (d) => { const x = d as { link: string; email: string }; return `Link for ${x.email}: ${x.link}`; })}>Owner link</Button>
        <Button size="sm" variant={suspended ? "primary" : "danger"} disabled={pending} onClick={confirmThen(suspended ? "Reactivate this operator?" : "Suspend this operator? Their whole team is locked out immediately.", () => run(() => setTenantStatusAction(tenantId, suspended ? "active" : "suspended")))}>{suspended ? "Reactivate" : "Suspend"}</Button>
      </div>
      {note && <p className="max-w-xs break-all text-xs text-muted" role="status">{note}</p>}
    </div>
  );
}
