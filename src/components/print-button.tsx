"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <Button type="button" variant="secondary" onClick={() => window.print()}><Printer className="size-4" aria-hidden />{label}</Button>;
}
