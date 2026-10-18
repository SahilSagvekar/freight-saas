"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withTenant } from "@/db";
import { fieldErrors } from "@/lib/form-errors";
import { shipmentSchema } from "@/lib/schemas";
import { readShipmentCsv } from "@/lib/shipment-import";
import { shipmentStatusEmail } from "@/lib/email-templates";
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUSES, type ShipmentStatus } from "@/lib/shipment";
import { trackingCode } from "@/lib/tracking-code";
import { appBaseUrl } from "./base-url";
import { sendMail, mailConfigured } from "./mail";
import { formatShipmentNo } from "./shared";
import { partyOf } from "./shipments";
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
  const wantsEmail = f.get("notify") === "on";
  const res = await withTenant(auth.tenantId, async (tx) => {
    const r = await setShipmentStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, p.data.id, p.data.status, p.data);
    if (!r.ok || !wantsEmail) return { r, to: [] as string[], route: "" };
    const s = await tx.shipment.findUnique({ where: { id: p.data.id }, select: { shipper: true, consignee: true, notifyParty: true, origin: true, destination: true } });
    const to = s ? [...new Set([partyOf(s.consignee).email, partyOf(s.notifyParty).email, partyOf(s.shipper).email].map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean))] : [];
    return { r, to, route: s ? `${s.origin} to ${s.destination}` : "" };
  });
  if (!res.r.ok) return { ok: false, error: res.r.error };
  revalidatePath("/app/shipments", "layout");

  let message = "Status updated";
  if (wantsEmail) {
    if (res.to.length === 0) message += ". No email sent: the shipment has no customer email address.";
    else if (!mailConfigured()) message += ". Email isn't set up yet, so nobody was emailed.";
    else {
      const url = `${await appBaseUrl()}/track/${encodeURIComponent(trackingCode(res.r.shipment.id))}`;
      const mail = shipmentStatusEmail({ operator: auth.tenant.name, shipmentNo: formatShipmentNo(res.r.shipment.shipmentNo), statusLabel: SHIPMENT_STATUS_LABELS[p.data.status as ShipmentStatus], route: res.route, location: p.data.location, note: p.data.note, url });
      const sent = (await Promise.all(res.to.map((a) => sendMail(a, mail)))).filter(Boolean).length;
      message += sent === res.to.length ? `. Emailed ${sent}.` : `. Emailed ${sent} of ${res.to.length}; the rest failed.`;
    }
  }
  return { ok: true, message };
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

export type ImportActionResult = { ok: true; imported: number } | { ok: false; errors: string[] };

const MAX_IMPORT_BYTES = 512 * 1024;

/** Imports shipments from a CSV. All or nothing: if any row has a problem, nothing is saved and every problem is listed. */
export async function importShipmentsAction(f: FormData): Promise<ImportActionResult> {
  const auth = await requireWrite("booking.create");
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, errors: ["Choose a CSV file first."] };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, errors: ["That file is too large. Split it into smaller files."] };
  const { shipments, errors } = readShipmentCsv(await file.text(), auth.tenant.baseCurrency);
  if (errors.length) return { ok: false, errors: errors.slice(0, 25).concat(errors.length > 25 ? [`…and ${errors.length - 25} more.`] : []) };
  const ctx = { tenantId: auth.tenantId, actorId: auth.userId };
  try {
    await withTenant(auth.tenantId, async (tx) => {
      for (const s of shipments) await createShipment(tx, ctx, s);
    });
  } catch (e) {
    console.error("shipment import failed", e);
    return { ok: false, errors: ["Something went wrong and nothing was imported. Please try again."] };
  }
  revalidatePath("/app/shipments", "layout");
  return { ok: true, imported: shipments.length };
}
