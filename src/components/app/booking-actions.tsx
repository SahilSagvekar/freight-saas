"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { formatMoney, fromMinor } from "@/lib/money";
import { cancelBookingAction, manifestAction, recordPaymentAction, reviewBookingAction } from "@/server/booking-actions";
import type { ManifestStatus } from "@/lib/domain";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <Button variant="secondary" onClick={() => setConfirming(true)}>Cancel booking</Button>;
  return (
    <div className="space-y-2">
      <Alert tone="warning" title="Cancel this booking?">Space is released and the invoice is voided.</Alert>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button variant="danger" disabled={pending} onClick={() => run(() => cancelBookingAction(bookingId))}>{pending ? "Cancelling…" : "Yes, cancel it"}</Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>Keep booking</Button>
      </div>
    </div>
  );
}

export function PaymentForm({ invoiceId, currency, locale, outstanding }: { invoiceId: string; currency: string; locale: string; outstanding: number }) {
  const { pending, error, run } = useAction();
  const [amount, setAmount] = useState(fromMinor(outstanding, currency));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => recordPaymentAction({ invoiceId, currency, amount, method, reference }));
      }}
    >
      <p className="text-sm text-muted">Outstanding: <span className="tabular font-semibold text-ink">{formatMoney(outstanding, currency, locale)}</span></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" htmlFor="pay-amount"><Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Reference" htmlFor="pay-ref" hint="Optional" className="col-span-2"><Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record payment"}</Button>
    </form>
  );
}

export function ReviewButtons({ bookingId }: { bookingId: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => reviewBookingAction(bookingId, "approve"))}>Accept</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => reviewBookingAction(bookingId, "reject", "Declined after review"))}>Decline</Button>
      </div>
    </div>
  );
}

const NEXT: Record<ManifestStatus, { to: ManifestStatus; label: string } | null> = {
  PENDING: { to: "LOADED", label: "Mark loaded" },
  LOADED: { to: "UNLOADED", label: "Mark unloaded" },
  UNLOADED: { to: "DELIVERED", label: "Deliver" },
  DELIVERED: null,
};

export function ManifestButton({ entryId, status }: { entryId: string; status: ManifestStatus }) {
  const { pending, error, run } = useAction();
  const [asking, setAsking] = useState(false);
  const [who, setWho] = useState("");
  const next = NEXT[status];
  if (!next) return null;
  if (asking) {
    return (
      <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => manifestAction(entryId, "DELIVERED", who), () => setAsking(false)); }}>
        <Input aria-label="Received by" className="h-8 w-36" placeholder="Received by" value={who} onChange={(e) => setWho(e.target.value)} autoFocus />
        <Button size="sm" type="submit" disabled={pending}>Confirm</Button>
        {error && <span className="text-xs text-danger-600">{error}</span>}
      </form>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => (next.to === "DELIVERED" ? setAsking(true) : run(() => manifestAction(entryId, next.to)))}>{next.label}</Button>
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </div>
  );
}
