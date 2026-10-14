"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { VoyageStatus } from "@/lib/domain";
import { voyageMoves } from "@/lib/voyage-flow";
import { voyageStatusAction } from "@/server/voyage-actions";

export function VoyageStatusButtons({ voyageId, status }: { voyageId: string; status: VoyageStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<VoyageStatus | null>(null);
  const moves = voyageMoves(status);
  if (moves.length === 0) return null;

  const go = (to: VoyageStatus) =>
    start(async () => {
      setError(null);
      const res = await voyageStatusAction(voyageId, to);
      if (!res.ok) return setError(res.error);
      setConfirm(null);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moves.map((m) =>
        m.danger && confirm !== m.to ? (
          <Button key={m.to} variant="secondary" disabled={pending} onClick={() => setConfirm(m.to)}>{m.label}</Button>
        ) : (
          <Button key={m.to} variant={m.danger ? "danger" : m.to === "SCHEDULED" ? "secondary" : "primary"} disabled={pending} onClick={() => go(m.to)}>
            {m.danger ? "Yes, cancel voyage" : m.label}
          </Button>
        ),
      )}
      {error && <span className="text-sm text-danger-600" role="alert">{error}</span>}
    </div>
  );
}
