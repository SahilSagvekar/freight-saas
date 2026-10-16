import { afterAll, describe, expect, it } from "vitest";
import { adminDb, closeDb, withTenant } from "@/db";
import { assertWithinPlan, handleStripeEvent, type StripeEvent } from "@/server/billing";
import { createBooking, recordPayment } from "@/server/bookings";
import { expireUnpaidHolds, loadPublicOperator } from "@/server/public-booking";
import { setTenantSetting } from "@/server/shared";
import { makeOperation, makeTenant } from "./helpers";

afterAll(closeDb);

const ev = (type: string, object: Record<string, unknown>, account?: string): StripeEvent => ({ id: `evt_${Math.random()}`, type, account, data: { object } });
const tenantRow = (id: string) => adminDb().tenant.findUniqueOrThrow({ where: { id } });

describe("subscription events", () => {
  it("links the customer on checkout, then follows the subscription through failure and cancellation", async () => {
    const t = await makeTenant("Bill");
    const customer = `cus_${Math.random().toString(36).slice(2)}`;
    await handleStripeEvent(ev("checkout.session.completed", { mode: "subscription", client_reference_id: t.tenantId, customer, subscription: "sub_1", metadata: { plan: "operator" } }));
    expect(await tenantRow(t.tenantId)).toMatchObject({ billingStatus: "active", stripeCustomerId: customer, plan: "operator" });

    const sub = { id: "sub_1", customer, status: "past_due", current_period_end: 1_900_000_000, items: { data: [{ price: { id: "price_x" } }] } };
    await handleStripeEvent(ev("customer.subscription.updated", sub));
    const late = await tenantRow(t.tenantId);
    expect(late.billingStatus).toBe("past_due");
    expect(late.pastDueSince).toBeTruthy();
    expect(late.currentPeriodEnd?.getTime()).toBe(1_900_000_000_000);

    await handleStripeEvent(ev("customer.subscription.updated", { ...sub, status: "active" }));
    expect(await tenantRow(t.tenantId)).toMatchObject({ billingStatus: "active", pastDueSince: null });

    await handleStripeEvent(ev("customer.subscription.deleted", { ...sub, status: "canceled" }));
    expect((await tenantRow(t.tenantId)).billingStatus).toBe("canceled");
  });

  it("ignores events for customers it doesn't know, and statuses it shouldn't act on", async () => {
    await expect(handleStripeEvent(ev("customer.subscription.updated", { id: "sub_x", customer: "cus_unknown", status: "active" }))).resolves.toBeUndefined();
    const t = await makeTenant("Bill");
    await adminDb().tenant.update({ where: { id: t.tenantId }, data: { stripeCustomerId: `cus_${Math.random()}`, billingStatus: "trialing" } });
    const row = await tenantRow(t.tenantId);
    await handleStripeEvent(ev("customer.subscription.updated", { id: "s", customer: row.stripeCustomerId, status: "incomplete" }));
    expect((await tenantRow(t.tenantId)).billingStatus).toBe("trialing");
  });
});

describe("ticket payments", () => {
  async function publicBooking() {
    const op = await makeOperation();
    const account = `acct_${Math.random().toString(36).slice(2)}`;
    await adminDb().tenant.update({ where: { id: op.tenantId }, data: { stripeAccountId: account } });
    const created = await withTenant(op.tenantId, (tx) =>
      createBooking(tx, { tenantId: op.tenantId, actorId: null, source: "PUBLIC" }, { voyageId: op.voyage.id, contactName: "Web", lines: [{ itemTypeId: op.type("Adult").id, quantity: 1 }] }),
    );
    return { op, account, created };
  }
  const session = (bookingId: string, amount: number, id = "cs_1") => ({ id, mode: "payment", payment_status: "paid", amount_total: amount, metadata: { bookingId } });

  it("records the card payment once, even if Stripe sends the event twice", async () => {
    const { op, account, created } = await publicBooking();
    const e = ev("checkout.session.completed", session(created.bookingId, created.total), account);
    await handleStripeEvent(e);
    await handleStripeEvent(e);
    const inv = await withTenant(op.tenantId, (tx) => tx.invoice.findFirstOrThrow({ where: { bookingId: created.bookingId }, include: { payments: true } }));
    expect(inv.status).toBe("PAID");
    expect(inv.payments).toHaveLength(1);
    expect(inv.payments[0]!.method).toBe("CARD");
  });

  it("ignores a payment event that claims to come from a different Stripe account", async () => {
    const { op, created } = await publicBooking();
    await handleStripeEvent(ev("checkout.session.completed", session(created.bookingId, created.total), "acct_someone_else"));
    const inv = await withTenant(op.tenantId, (tx) => tx.invoice.findFirstOrThrow({ where: { bookingId: created.bookingId } }));
    expect(inv.status).toBe("UNPAID");
  });

  it("leaves a trail instead of failing when the money arrives for a cancelled booking", async () => {
    const { op, account, created } = await publicBooking();
    await withTenant(op.tenantId, (tx) => tx.invoice.updateMany({ where: { bookingId: created.bookingId }, data: { status: "VOID" } }));
    await handleStripeEvent(ev("checkout.session.completed", session(created.bookingId, created.total, "cs_late"), account));
    const log = await withTenant(op.tenantId, (tx) => tx.auditLog.findFirst({ where: { action: "payment.orphaned" } }));
    expect(log).toBeTruthy();
  });
});

describe("plan limits", () => {
  it("stops a Starter operator adding a second vessel, but never limits complimentary ones", async () => {
    const t = await makeTenant("Limit");
    await adminDb().tenant.update({ where: { id: t.tenantId }, data: { billingStatus: "active", plan: "starter" } });
    await adminDb().vessel.create({ data: { tenantId: t.tenantId, name: "One", capacities: { PASSENGER: 1, VEHICLE: 0, CARGO: 0 } } });
    await expect(withTenant(t.tenantId, (tx) => assertWithinPlan(tx, t.tenantId, "vessel"))).rejects.toThrow(/1 vessel/);
    await adminDb().tenant.update({ where: { id: t.tenantId }, data: { billingStatus: "comped" } });
    await expect(withTenant(t.tenantId, (tx) => assertWithinPlan(tx, t.tenantId, "vessel"))).resolves.toBeUndefined();
  });
});

describe("public booking holds", () => {
  async function onlineBooking(minutesOld: number, connected: boolean) {
    const op = await makeOperation();
    if (connected) await adminDb().tenant.update({ where: { id: op.tenantId }, data: { stripeAccountId: `acct_${Math.random().toString(36).slice(2)}` } });
    const made = await withTenant(op.tenantId, (tx) =>
      createBooking(tx, { tenantId: op.tenantId, actorId: null, source: "PUBLIC" }, { voyageId: op.voyage.id, contactName: "Web", contactEmail: "web@example.test", lines: [{ itemTypeId: op.type("Adult").id, quantity: 1 }] }),
    );
    await adminDb().booking.update({ where: { id: made.bookingId }, data: { createdAt: new Date(Date.now() - minutesOld * 60_000) } });
    return { op, made };
  }
  const status = (tenantId: string, id: string) => withTenant(tenantId, (tx) => tx.booking.findUniqueOrThrow({ where: { id } }).then((b) => b.status));

  it("frees seats from unpaid card bookings once the hold is over", async () => {
    const { op, made } = await onlineBooking(60, true);
    expect(await expireUnpaidHolds({ tenantId: op.tenantId })).toBe(1);
    expect(await status(op.tenantId, made.bookingId)).toBe("CANCELLED");
  });

  it("leaves recent holds, pay-at-the-dock bookings and paid bookings alone", async () => {
    const recent = await onlineBooking(5, true);
    expect(await expireUnpaidHolds({ tenantId: recent.op.tenantId })).toBe(0);
    expect(await status(recent.op.tenantId, recent.made.bookingId)).toBe("CONFIRMED");

    const dock = await onlineBooking(600, false);
    expect(await expireUnpaidHolds({ tenantId: dock.op.tenantId })).toBe(0);
    expect(await status(dock.op.tenantId, dock.made.bookingId)).toBe("CONFIRMED");

    const paid = await onlineBooking(600, true);
    await withTenant(paid.op.tenantId, (tx) => recordPayment(tx, { tenantId: paid.op.tenantId, actorId: null }, paid.made.invoiceId!, { method: "CARD", amount: paid.made.total }));
    expect(await expireUnpaidHolds({ tenantId: paid.op.tenantId })).toBe(0);
  });

  it("stores the customer's email and marks the source", async () => {
    const { op, made } = await onlineBooking(0, false);
    const row = await withTenant(op.tenantId, (tx) => tx.booking.findUniqueOrThrow({ where: { id: made.bookingId } }));
    expect(row).toMatchObject({ source: "PUBLIC", contactEmail: "web@example.test", createdBy: null });
  });

  it("only serves operators who switched online booking on and are in good standing", async () => {
    const op = await makeOperation();
    const slug = (await adminDb().tenant.findUniqueOrThrow({ where: { id: op.tenantId } })).slug;
    expect(await loadPublicOperator(slug)).toBeNull(); // off by default
    await withTenant(op.tenantId, (tx) => setTenantSetting(tx, op.tenantId, "publicBookingEnabled", true));
    expect(await loadPublicOperator(slug)).toMatchObject({ id: op.tenantId });
    await adminDb().tenant.update({ where: { id: op.tenantId }, data: { billingStatus: "trialing", trialEndsAt: new Date(Date.now() - 1000) } });
    expect(await loadPublicOperator(slug)).toBeNull(); // lapsed trial
    await adminDb().tenant.update({ where: { id: op.tenantId }, data: { billingStatus: "comped", status: "suspended" } });
    expect(await loadPublicOperator(slug)).toBeNull();
    expect(await loadPublicOperator("no-such-operator")).toBeNull();
  });
});
