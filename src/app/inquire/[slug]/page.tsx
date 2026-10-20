import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadInquiryOperator } from "@/server/inquiries";
import { turnstileSiteKey } from "@/server/turnstile";
import { InquiryForm } from "./inquiry-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/inquire/[slug]">): Promise<Metadata> {
  const op = await loadInquiryOperator((await params).slug);
  return { title: op ? `Request a quote · ${op.name}` : "Not found", robots: { index: false } };
}

/** The operator's website embeds this page in an iframe, so it carries no site chrome of its own. */
export default async function InquiryPage({ params }: PageProps<"/inquire/[slug]">) {
  const { slug } = await params;
  const op = await loadInquiryOperator(slug);
  if (!op) notFound();
  return (
    <main className="min-h-screen bg-surface px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Request a quote</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Tell {op.name} what you need to ship and we&apos;ll get back to you.</p>
        <InquiryForm slug={slug} captchaSiteKey={turnstileSiteKey()} />
      </div>
    </main>
  );
}
