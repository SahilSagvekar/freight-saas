"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTenant } from "@/db";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/lib/domain";
import { parseEmails } from "@/lib/email-list";
import { inquirySchema } from "@/lib/schemas";
import { requireWrite } from "./auth";
import type { ActionResult } from "./booking-actions";
import { createInquiry, loadInquiryOperator, notifyInquiry, setInquiryNotes, setInquiryStatus } from "./inquiries";
import { setTenantSetting } from "./shared";
import { throttle } from "./throttle";

export type InquiryFormState = { error?: string; fields?: Record<string, string>; done?: { message: string } };

/**
 * The website form's submit. The operator comes from the page's slug, never from the request body.
 * Bots are turned away quietly (a hidden field, then a per-connection and per-operator limit).
 */
export async function submitInquiryAction(slug: string, _prev: InquiryFormState, form: FormData): Promise<InquiryFormState> {
  const op = await loadInquiryOperator(slug);
  if (!op) return { error: "This form isn't available right now." };

  // A hidden field only bots fill in. Say "thanks" and store nothing, so they learn nothing.
  if (String(form.get("website") ?? "").trim() !== "") return { done: { message: op.thanks } };

  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fields[key]) fields[key] = issue.message;
    }
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", fields };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await throttle(`inquiry:${op.id}:${ip}`, 5, 60 * 60 * 1000)).allowed) return { error: "Too many requests from this connection. Please try again later." };
  if (!(await throttle(`inquiry-day:${op.id}`, 300, 24 * 60 * 60 * 1000)).allowed) return { error: "This form is receiving a lot of requests right now. Please email us instead." };

  try {
    const row = await withTenant(op.id, (tx) => createInquiry(tx, { tenantId: op.id, actorId: null, source: "FORM" }, parsed.data));
    // Awaited so the email isn't cut off when a serverless function returns; it never throws.
    await notifyInquiry(op.id, row.id);
  } catch (e) {
    console.error("inquiry submit failed", e);
    return { error: "Something went wrong. Please try again." };
  }
  return { done: { message: op.thanks } };
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(INQUIRY_STATUSES) });

export async function setInquiryStatusAction(f: FormData): Promise<ActionResult> {
  const auth = await requireWrite("booking.create");
  const p = statusSchema.safeParse({ id: String(f.get("id") ?? ""), status: String(f.get("status") ?? "") });
  if (!p.success) return { ok: false, error: "Choose a status." };
  const ok = await withTenant(auth.tenantId, (tx) => setInquiryStatus(tx, { tenantId: auth.tenantId, actorId: auth.userId }, p.data.id, p.data.status as InquiryStatus));
  if (!ok) return { ok: false, error: "That inquiry no longer exists." };
  revalidatePath("/app/inquiries", "layout");
  return { ok: true, message: "Status updated" };
}

export async function saveInquiryNotesAction(f: FormData): Promise<ActionResult> {
  const auth = await requireWrite("booking.create");
  const p = z.object({ id: z.string().uuid(), notes: z.string().max(4000) }).safeParse({ id: String(f.get("id") ?? ""), notes: String(f.get("notes") ?? "") });
  if (!p.success) return { ok: false, error: "Notes are too long (4000 characters at most)." };
  const ok = await withTenant(auth.tenantId, (tx) => setInquiryNotes(tx, { tenantId: auth.tenantId, actorId: auth.userId }, p.data.id, p.data.notes));
  if (!ok) return { ok: false, error: "That inquiry no longer exists." };
  revalidatePath("/app/inquiries", "layout");
  return { ok: true, message: "Notes saved" };
}

export async function saveInquirySettingsAction(f: FormData): Promise<ActionResult> {
  const auth = await requireWrite("settings.manage");
  const on = f.get("enabled") === "on";
  const notifyRaw = String(f.get("notify") ?? "");
  const notify = parseEmails(notifyRaw);
  if (notifyRaw.trim() && notify.length === 0) return { ok: false, error: "Enter at least one valid email address, separated by commas." };
  const thanks = String(f.get("thanks") ?? "").trim().slice(0, 500);
  await withTenant(auth.tenantId, async (tx) => {
    await setTenantSetting(tx, auth.tenantId, "inquiryEnabled", on);
    await setTenantSetting(tx, auth.tenantId, "inquiryNotify", notify.join(", "));
    if (thanks) await setTenantSetting(tx, auth.tenantId, "inquiryThanks", thanks);
  });
  revalidatePath("/app/settings");
  return { ok: true, message: on ? "Website form is on" : "Website form is off" };
}
