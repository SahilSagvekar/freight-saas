import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/utils";

export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm text-brand-700 hover:underline">← {APP_NAME}</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-8 space-y-4 text-[15px] leading-7 text-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">{children}</div>
    </main>
  );
}

export const contactEmail = () => process.env.CONTACT_EMAIL ?? "support@example.com";
