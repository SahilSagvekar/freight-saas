"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/booking-actions";

/** A form that runs a server action, shows its error or success message, and clears itself on success. */
export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  onSuccess,
  reset = true,
}: {
  action: (data: FormData) => Promise<ActionResult & { id?: string }>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
  onSuccess?: (result: ActionResult & { id?: string }) => void;
  reset?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(data);
          setState(res);
          if (res.ok) {
            if (reset) ref.current?.reset();
            onSuccess?.(res);
            router.refresh();
          }
        });
      }}
    >
      {children}
      {state && !state.ok && <Alert tone="error" className="mt-3">{state.error}</Alert>}
      {state?.ok && state.message && <Alert tone="success" className="mt-3">{state.message}</Alert>}
      <Button type="submit" className="mt-4" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
