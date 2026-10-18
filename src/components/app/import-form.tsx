"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { importShipmentsAction, type ImportActionResult } from "@/server/shipment-actions";

export function ImportForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportActionResult | null>(null);
  return (
    <form
      ref={ref}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => {
          const res = await importShipmentsAction(data);
          setResult(res);
          if (res.ok) {
            ref.current?.reset();
            router.refresh();
          }
        });
      }}
    >
      <input type="file" name="file" accept=".csv,text/csv" aria-label="CSV file" className="block w-full text-sm" required />
      <Button type="submit" disabled={pending}>{pending ? "Importing…" : "Import shipments"}</Button>
      {result?.ok && <Alert tone="success">Imported {result.imported} shipment{result.imported === 1 ? "" : "s"}.</Alert>}
      {result && !result.ok && (
        <Alert tone="error" title="Nothing was imported">
          <ul className="list-disc pl-5">{result.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </Alert>
      )}
    </form>
  );
}
