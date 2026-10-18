"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTenant } from "@/db";
import { fieldErrors } from "@/lib/form-errors";
import { shipmentSchema } from "@/lib/schemas";
import { SHIPMENT_STATUSES } from "@/lib/shipment";
import { requireWrite } from "./auth";
import type { ActionResult } from "./booking-actions";
import { createShipment, createShipmentFromInquiry, setShipmentStatus, updateShipment } from "./shipments";

/** Create (id = null) or update a shipment from the form. */
export async function saveShipmentAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireWrite("booking.create");
  const parsed = shipmentSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again.", fields };
  }
  if (id !== null && !z.string().uuid().safeParse(id).success) return { ok: false, error: "That shipment no longer exists." };
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  try {
    const row = await withTenant(auth.tenantId, (tx) => (id ? updateShipment(tx, ctx, id, parsed.data) : createShipment(tx, ctx, parsed.data)));
    if (!row) return { ok: false, error: "That shipment no longer exists." };
    revalidatePath("/app/shipments", "layout");
    return { ok: true, data: { id: row.id }, message: id ? "Shipment saved" : "Shipment created" };
  } catch (e) {
    console.error("save shipment failed", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(SHIPMENT_STATUSES), note: z.string().trim().max(500).optional(), location: z.string().trim().max(160).optional() });

export async function setShipmentStatusAction(f: FormData): Promise<ActionResult> {
  const auth = await requireWrite("manifest.update");
  const p = statusSchema.safeParse({ id: String(f.get("id") ?? ""), status: String(f.get("status") ?? ""), note: String(f.get("note") ?? ""), location: String(f.get("location") ?? "") });
  if (!p.success) return { ok: false, error: "Choose a status." };
  const res = await withTenant(auth.tenantId, (tx) => setShipmentStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, p.data.id, p.data.status, p.data));
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/app/shipments", "layout");
  return { ok: true, message: "Status updated" };
}

/** "Convert to shipment" on an inquiry: makes (or finds) the shipment and opens it for editing. */
export async function convertInquiryAction(f: FormData): Promise<void> {
  const auth = await requireWrite("booking.create");
  const id = String(f.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) redirect("/app/inquiries");
  const made = await withTenant(auth.tenantId, (tx) => createShipmentFromInquiry(tx, { tenantId: auth.tenantId, actorId: auth.userId }, id, auth.tenant.baseCurrency));
  if (!made) redirect("/app/inquiries");
  revalidatePath("/app/inquiries", "layout");
  redirect(`/app/shipments/${made.id}/edit`);
}
