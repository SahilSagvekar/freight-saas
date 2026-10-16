import { Anchor } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/app/booking-form";
import { withTenant } from "@/db";
import { loadPublicOperator } from "@/server/public-booking";
import { createPublicBookingAction } from "@/server/public-actions";
import { bookingFormData } from "@/server/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const op = await loadPublicOperator((await params).slug);
  return { title: op ? `Book a ticket · ${op.name}` : "Not found", robots: { index: false } };
}

export default async function PublicBookingPage({ params }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  const op = await loadPublicOperator(slug);
  if (!op) notFound();
  const data = await withTenant(op.id, (tx) => bookingFormData(tx));
  return (
    <main className="min-h-screen bg-canvas">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-4 font-semibold sm:px-6">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500"><Anchor className="size-4" aria-hidden /></span>
          {op.name}
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Book your tickets</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Choose your sailing and what is travelling. {op.stripeAccountId ? "You'll pay by card on the next step." : "You'll pay at the ticket desk before boarding."}
        </p>
        <BookingForm data={data} currency={op.baseCurrency} locale={op.locale} submit={createPublicBookingAction.bind(null, slug)} askEmail />
      </div>
    </main>
  );
}
