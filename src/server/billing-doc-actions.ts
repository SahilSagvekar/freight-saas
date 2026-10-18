"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTenant } from "@/db";
import { BillingMathError } from "@/lib/freight-billing";
import { fieldErrors } from "@/lib/form-errors";
import { freightInvoiceSchema, quoteSchema } from "@/lib/schemas";
import { localDateString } from "@/lib/tz";
import { requireWrite } from "./auth";
import type { ActionResult } from "./booking-actions";
import { createFreightInvoice, setFreightInvoiceStatus, updateFreightInvoice } from "./freight-invoices";
import { createQuote, createShipmentFromQuote, setQuoteStatus, updateQuote } from "./quotes";

const uuid = z.string().uuid();

export async function saveQuoteAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireWrite("booking.create");
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again.", fields: fieldErrors(parsed.error) };
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "That quote no longer exists." };
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  try {
    const res = await withTenant(auth.tenantId, async (tx) => {
      if (id) return updateQuote(tx, ctx, id, parsed.data);
      const row = await createQuote(tx, ctx, parsed.data);
      return { ok: true as const, id: row.id };
    });
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath("/app/quotes", "layout");
    revalidatePath("/app/inquiries", "layout");
    return { ok: true, data: { id: res.id }, message: id ? "Quote saved" : "Quote created" };
  } catch (e) {
    if (e instanceof BillingMathError) return { ok: false, error: e.message };
    console.error("save quote failed", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function setQuoteStatusAction(f: FormData): Promise<ActionResult> {
  const auth = await requireWrite("booking.create");
  const id = String(f.get("id") ?? "");
  if (!uuid.safeParse(id).success) return { ok: false, error: "That quote no longer exists." };
  const res = await withTenant(auth.tenantId, (tx) => setQuoteStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, id, String(f.get("status") ?? "")));
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/app/quotes", "layout");
  return { ok: true, message: "Quote updated" };
}

/** "Accepted: make it a shipment." Opens the new shipment for editing. */
export async function quoteToShipmentAction(f: FormData): Promise<void> {
  const auth = await requireWrite("booking.create");
  const id = String(f.get("id") ?? "");
  if (!uuid.safeParse(id).success) redirect("/app/quotes");
  const made = await withTenant(auth.tenantId, (tx) => createShipmentFromQuote(tx, { tenantId: auth.tenantId, actorId: auth.userId }, id));
  if (!made) redirect("/app/quotes");
  revalidatePath("/app/quotes", "layout");
  revalidatePath("/app/shipments", "layout");
  redirect(`/app/shipments/${made.id}/edit`);
}

export async function saveInvoiceAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireWrite("payment.record");
  const parsed = freightInvoiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again.", fields: fieldErrors(parsed.error) };
  if (id !== null && !uuid.safeParse(id).success) return { ok: false, error: "That invoice no longer exists." };
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  try {
    const res = await withTenant(auth.tenantId, async (tx) => {
      if (id) return updateFreightInvoice(tx, ctx, id, parsed.data);
      const row = await createFreightInvoice(tx, ctx, parsed.data);
      return { ok: true as const, id: row.id };
    });
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath("/app/invoices", "layout");
    return { ok: true, data: { id: res.id }, message: id ? "Invoice saved" : "Invoice created" };
  } catch (e) {
    if (e instanceof BillingMathError) return { ok: false, error: e.message };
    console.error("save invoice failed", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function setInvoiceStatusAction(f: FormData): Promise<ActionResult> {
  const auth = await requireWrite("payment.record");
  const id = String(f.get("id") ?? "");
  if (!uuid.safeParse(id).success) return { ok: false, error: "That invoice no longer exists." };
  const today = localDateString(new Date(), auth.tenant.timeZone);
  const res = await withTenant(auth.tenantId, (tx) => setFreightInvoiceStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, id, String(f.get("status") ?? ""), today));
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/app/invoices", "layout");
  return { ok: true, message: "Invoice updated" };
}
