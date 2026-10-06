"use client";

import { CheckCircle2, CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { deviceId, enqueue, loadCache, newOpId, pending, recentOutcomes, saveCache, settle, type OpOutcome, type QueuedOp } from "@/lib/offline-queue";
import { formatMoney } from "@/lib/money";
import type { BookingFormData } from "@/server/queries";
import { BookingForm, type BookingSubmit } from "./booking-form";

type Boot = { data: BookingFormData; currency: string; locale: string; tenantId: string; fetchedAt: string };

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

export function Desk({ tenantId }: { tenantId: string }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [queued, setQueued] = useState<QueuedOp[]>([]);
  const [outcomes, setOutcomes] = useState<OpOutcome[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const flushing = useRef(false);

  const refreshLists = useCallback(async () => {
    setQueued(await pending(tenantId));
    setOutcomes(await recentOutcomes(tenantId));
  }, [tenantId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    try {
      const ops = await pending(tenantId);
      if (ops.length === 0) return;
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: await deviceId(), ops: ops.map((o) => ({ clientOpId: o.clientOpId, type: "CREATE_BOOKING", payload: o.payload })) }),
      });
      if (res.status === 401) return setSignedOut(true);
      if (!res.ok) return; // keep everything queued and try again later
      const { results } = (await res.json()) as { results: { clientOpId: string; status: OpOutcome["status"]; bookingNo?: string; reason?: string }[] };
      for (const r of results) {
        const op = ops.find((o) => o.clientOpId === r.clientOpId);
        if (op) await settle(op, { status: r.status, bookingNo: r.bookingNo, reason: r.reason });
      }
      await loadBootstrap();
    } catch {
      /* offline: leave the queue as it is */
    } finally {
      flushing.current = false;
      setSyncing(false);
      await refreshLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, refreshLists]);

  async function loadBootstrap() {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (res.status === 401) return setSignedOut(true);
      if (!res.ok) throw new Error();
      const fresh = (await res.json()) as Boot;
      await saveCache(`boot:${tenantId}`, fresh);
      setBoot(fresh);
      setLoadError(null);
    } catch {
      const cached = await loadCache<Boot>(`boot:${tenantId}`);
      if (cached) setBoot((b) => b ?? cached);
      else setLoadError("Open the ticket desk once while online so prices and sailings can be saved on this device.");
    }
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const up = () => void flush();
    window.addEventListener("online", up);
    void (async () => {
      await refreshLists();
      await loadBootstrap();
      void flush();
    })();
    const timer = setInterval(() => navigator.onLine && void flush(), 30000);
    return () => { window.removeEventListener("online", up); clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit: BookingSubmit = async (input) => {
    if (!boot) return { ok: false, error: "Prices are not loaded yet." };
    const voyage = boot.data.voyages.find((v) => v.id === input.voyageId);
    const op: QueuedOp = {
      clientOpId: newOpId(),
      tenantId,
      createdAt: Date.now(),
      payload: input,
      summary: { name: input.contactName, total: input.quotedTotal ?? 0, currency: boot.currency, voyage: voyage?.label ?? "" },
    };
    await enqueue(op); // saved on the device first, so nothing is lost if the connection drops mid-sale
    await refreshLists();
    void flush();
    return { ok: true, data: { queued: true } };
  };

  const banner = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
      <p className="flex items-center gap-2 text-sm font-medium">
        {online ? <Wifi className="size-4 text-ok-600" aria-hidden /> : <CloudOff className="size-4 text-warn-600" aria-hidden />}
        {online ? "Online" : "Offline — sales are saved on this device"}
      </p>
      <div className="flex items-center gap-2">
        {queued.length > 0 && <Badge tone="warn">{queued.length} waiting to upload</Badge>}
        <Button size="sm" variant="secondary" onClick={() => void flush()} disabled={!online || syncing || queued.length === 0}>
          <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden />Sync now
        </Button>
      </div>
    </div>
  );

  if (signedOut) return <Alert tone="warning" title="Your session has ended">Sign in again to upload the {queued.length} sale(s) saved on this device. They are safe.</Alert>;
  if (!boot) return <div className="space-y-4">{banner}{loadError ? <Alert tone="error">{loadError}</Alert> : <p className="text-sm text-muted">Loading prices and sailings…</p>}</div>;

  return (
    <div className="space-y-6">
      <BookingForm data={boot.data} currency={boot.currency} locale={boot.locale} submit={submit} banner={banner} />
      {(queued.length > 0 || outcomes.length > 0) && (
        <Card>
          <CardHeader title="Sales from this device" />
          <ul className="divide-y divide-line">
            {queued.map((q) => (
              <li key={q.clientOpId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><span className="font-medium">{q.summary.name}</span> <span className="text-muted">· {q.summary.voyage}</span></span>
                <span className="flex items-center gap-3"><span className="tabular">{formatMoney(q.summary.total, q.summary.currency, boot.locale)}</span><Badge tone="warn">Waiting</Badge></span>
              </li>
            ))}
            {outcomes.map((o) => (
              <li key={o.clientOpId} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span><span className="font-medium">{o.summary.name}</span> <span className="text-muted">· {o.summary.voyage}</span></span>
                  <span className="flex items-center gap-3">
                    {o.bookingNo && <span className="tabular text-muted">{o.bookingNo}</span>}
                    {o.status === "APPLIED" ? <Badge tone="ok"><CheckCircle2 className="size-3" aria-hidden />Uploaded</Badge> : o.status === "NEEDS_REVIEW" ? <Badge tone="warn">Needs review</Badge> : <Badge tone="danger">Not accepted</Badge>}
                  </span>
                </div>
                {o.reason && <p className="mt-1 text-xs text-muted">{o.reason}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
