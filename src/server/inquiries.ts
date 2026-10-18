import { adminDb, withTenant, type Tx } from "@/db";
import { billingAccess, type BillingStatus } from "@/lib/billing";
import { INQUIRY_STATUSES, MODE_LABELS, type InquiryStatus, type TransportMode } from "@/lib/domain";
import { parseEmails } from "@/lib/email-list";
import type { InquiryInput } from "@/lib/schemas";
import { appBaseUrl } from "./base-url";
import { audit, formatInquiryNo, getTenantConfig, nextNumber } from "./shared";

export type PublicInquiryOperator = { id: string; name: string; slug: string; thanks: string };

/** The operator behind /inquire/<slug>, or null if there is no such form: unknown, suspended, switched off or lapsed. */
export async function loadInquiryOperator(slug: string): Promise<PublicInquiryOperator | null> {
  const t = await adminDb().tenant.findUnique({ where: { slug } });
  if (!t || t.status !== "active") return null;
  const access = billingAccess({ status: t.billingStatus as BillingStatus, trialEndsAt: t.trialEndsAt, currentPeriodEnd: t.currentPeriodEnd, pastDueSince: t.pastDueSince });
  if (access.level !== "full") return null;
  const config = await withTenant(t.id, (tx) => getTenantConfig(tx));
  if (!config.inquiryEnabled) return null;
  return { id: t.id, name: t.name, slug: t.slug, thanks: config.inquiryThanks };
}

export async function createInquiry(tx: Tx, ctx: { tenantId: string; actorId: string | null; source: "FORM" | "STAFF" }, input: InquiryInput) {
  const inquiryNo = await nextNumber(tx, ctx.tenantId, "inquiry");
  const row = await tx.inquiry.create({
    data: {
      tenantId: ctx.tenantId,
      inquiryNo,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      company: input.company || null,
      mode: input.mode,
      origin: input.origin,
      destination: input.destination,
      cargo: input.cargo,
      weightKg: input.weightKg ?? null,
      readyOn: input.readyOn ? new Date(`${input.readyOn}T00:00:00.000Z`) : null,
      message: input.message || null,
      source: ctx.source,
    },
  });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "inquiry.create", entity: "inquiry", entityId: row.id, after: { inquiryNo, mode: input.mode, source: ctx.source } });
  return row;
}

/** Emails the team about a new inquiry, and (if mail is set up) the visitor a receipt. Never throws. */
export async function notifyInquiry(tenantId: string, inquiryId: string): Promise<void> {
  try {
    const [{ sendMail }, { inquiryAlertEmail, inquiryReceivedEmail }] = await Promise.all([import("./mail"), import("@/lib/email-templates")]);
    const data = await withTenant(tenantId, async (tx) => ({ row: await tx.inquiry.findUnique({ where: { id: inquiryId } }), config: await getTenantConfig(tx) }));
    if (!data.row) return;
    const operator = await adminDb().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
    const base = await appBaseUrl().catch(() => process.env.APP_URL ?? "");
    const r = data.row;
    const route = `${r.origin} → ${r.destination}`;
    const alert = inquiryAlertEmail({ operator: operator.name, no: formatInquiryNo(r.inquiryNo), name: r.name, company: r.company, mode: MODE_LABELS[r.mode as TransportMode] ?? r.mode, route, cargo: r.cargo, url: `${base}/app/inquiries/${r.id}` });
    for (const to of parseEmails(data.config.inquiryNotify)) await sendMail(to, alert);
    await sendMail(r.email, inquiryReceivedEmail({ name: r.name, operator: operator.name, message: data.config.inquiryThanks, route }));
  } catch (e) {
    console.error("inquiry notification failed", e);
  }
}

export async function listInquiries(tx: Tx, opts: { status?: string; limit?: number } = {}) {
  const status = INQUIRY_STATUSES.includes(opts.status as InquiryStatus) ? opts.status : undefined;
  return tx.inquiry.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: opts.limit ?? 200 });
}

export async function inquiryCounts(tx: Tx): Promise<Record<InquiryStatus, number>> {
  const rows = await tx.inquiry.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<InquiryStatus, number> = { NEW: 0, QUOTED: 0, WON: 0, LOST: 0 };
  for (const r of rows) if (r.status in out) out[r.status as InquiryStatus] = r._count._all;
  return out;
}

export async function setInquiryStatus(tx: Tx, ctx: { tenantId: string; actorId: string }, id: string, status: InquiryStatus) {
  const before = await tx.inquiry.findUnique({ where: { id } });
  if (!before) return false;
  await tx.inquiry.update({ where: { id }, data: { status, updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "inquiry.status", entity: "inquiry", entityId: id, before: { status: before.status }, after: { status } });
  return true;
}

export async function setInquiryNotes(tx: Tx, ctx: { tenantId: string; actorId: string }, id: string, notes: string) {
  const before = await tx.inquiry.findUnique({ where: { id }, select: { id: true } });
  if (!before) return false;
  await tx.inquiry.update({ where: { id }, data: { notes: notes.trim() || null, updatedAt: new Date() } });
  await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.actorId, action: "inquiry.notes", entity: "inquiry", entityId: id });
  return true;
}
