"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleTaxAction } from "@/server/settings-actions";

export function TaxToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await toggleTaxAction(id, !active); router.refresh(); })}>{active ? "Turn off" : "Turn on"}</Button>;
}
