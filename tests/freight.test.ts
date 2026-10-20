import { afterAll, describe, expect, it } from "vitest";
import { closeDb, withTenant } from "@/db";
import { createFreightInvoice, freightInvoiceCounts, receivables, setFreightInvoiceStatus, updateFreightInvoice } from "@/server/freight-invoices";
import { createInquiry } from "@/server/inquiries";
import { createQuote, createShipmentFromQuote, quoteCounts, setQuoteStatus, updateQuote } from "@/server/quotes";
import { createShipment, createShipmentFromInquiry, listShipments, setShipmentStatus, shipmentCounts, updateShipment } from "@/server/shipments";
import type { FreightInvoiceInput, QuoteInput, ShipmentInput } from "@/lib/schemas";
import { makeTenant } from "./helpers";

afterAll(closeDb);

const party = (name: string) => ({ name, address: "1 Road", phone: "", email: `${name.toLowerCase()}@x.test`, taxId: "" });
const pkg = (quantity = 2, grossWeightKg: number | null = 100) => ({ quantity, packageType: "Pallet", description: "Tiles", lengthCm: 100, widthCm: 100, heightCm: 100, grossWeightKg, marks: "", hsCode: "", declaredValue: 5000 });
const shipment = (over: Partial<ShipmentInput> = {}): ShipmentInput => ({
  mode: "OCEAN", customerRef: "", shipper: party("Acme"), consignee: party("Bolt"), notifyParty: null, origin: "Shanghai", destination: "Rotterdam", incoterm: "FOB", carrier: "", vesselOrFlight: "", voyageNo: "",
  masterNo: "", houseNo: "", containerNo: "", sealNo: "", etd: "2026-11-03", eta: "", goods: "Tiles", marks: "", currency: "USD", notes: "", packages: [pkg()], ...over,
});
const lines = [{ description: "Ocean freight", quantity: 2, unitPrice: 50000 }];
const quote = (over: Partial<QuoteInput> = {}): QuoteInput => ({ customerName: "Priya", customerCompany: "", customerEmail: "p@x.test", customerAddress: "", mode: "OCEAN", origin: "A", destination: "B", validUntil: "", currency: "USD", taxBp: 1000, lines, notes: "", ...over });
const invoice = (over: Partial<FreightInvoiceInput> = {}): FreightInvoiceInput => ({ customerName: "Priya", customerCompany: "", customerEmail: "", customerAddress: "", reference: "", issuedOn: "2026-05-01", dueOn: "2026-05-15", currency: "USD", taxBp: 0, lines, notes: "", ...over });

describe("shipments", () => {
  it("numbers per operator and writes a first history entry", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const ctx = (t: typeof a) => ({ tenantId: t.tenantId, actorId: t.ownerUserId });
    const one = await withTenant(a.tenantId, (tx) => createShipment(tx, ctx(a), shipment()));
    const two = await withTenant(a.tenantId, (tx) => createShipment(tx, ctx(a), shipment()));
    const other = await withTenant(b.tenantId, (tx) => createShipment(tx, ctx(b), shipment()));
    expect([one.shipmentNo, two.shipmentNo, other.shipmentNo]).toEqual([1, 2, 1]);
    const events = await withTenant(a.tenantId, (tx) => tx.shipmentEvent.findMany({ where: { shipmentId: one.id } }));
    expect(events.map((e) => e.status)).toEqual(["BOOKED"]);
  });

  it("keeps shipments, packages and events private to their operator", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const made = await withTenant(a.tenantId, (tx) => createShipment(tx, { tenantId: a.tenantId, actorId: null }, shipment()));
    expect(await withTenant(b.tenantId, (tx) => listShipments(tx))).toEqual([]);
    expect(await withTenant(b.tenantId, (tx) => tx.shipment.findUnique({ where: { id: made.id } }))).toBeNull();
    expect(await withTenant(b.tenantId, (tx) => tx.shipmentPackage.findMany())).toEqual([]);
    expect(await withTenant(b.tenantId, (tx) => tx.shipmentEvent.findMany())).toEqual([]);
    await expect(withTenant(b.tenantId, (tx) => createShipment(tx, { tenantId: a.tenantId, actorId: null }, shipment()))).rejects.toThrow();
  });

  it("replaces package lines on edit and clears the notify party", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const made = await withTenant(t.tenantId, (tx) => createShipment(tx, ctx, shipment({ notifyParty: party("Notify") })));
    await withTenant(t.tenantId, (tx) => updateShipment(tx, ctx, made.id, shipment({ notifyParty: null, packages: [pkg(1, 5), pkg(3, 7)] })));
    const row = await withTenant(t.tenantId, (tx) => tx.shipment.findUniqueOrThrow({ where: { id: made.id }, include: { packages: true } }));
    expect(row.notifyParty).toBeNull();
    expect(row.packages).toHaveLength(2);
  });

  it("follows the status flow, records history, and refuses jumps", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const made = await withTenant(t.tenantId, (tx) => createShipment(tx, ctx, shipment()));
    const move = (to: string) => withTenant(t.tenantId, (tx) => setShipmentStatus(tx, ctx, made.id, to, { location: "Port" }));
    expect((await move("DELIVERED")).ok).toBe(false);
    expect((await move("IN_TRANSIT")).ok).toBe(true);
    expect((await move("ARRIVED")).ok).toBe(true);
    const counts = await withTenant(t.tenantId, (tx) => shipmentCounts(tx));
    expect(counts.active).toBe(1);
    expect((await withTenant(t.tenantId, (tx) => listShipments(tx, { status: "active" })))).toHaveLength(1);
    const history = await withTenant(t.tenantId, (tx) => tx.shipmentEvent.findMany({ where: { shipmentId: made.id }, orderBy: { createdAt: "asc" } }));
    expect(history.map((e) => e.status)).toEqual(["BOOKED", "IN_TRANSIT", "ARRIVED"]);
  });

  it("searches by number, reference and container", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: null };
    await withTenant(t.tenantId, (tx) => createShipment(tx, ctx, shipment({ customerRef: "PO-77", containerNo: "MSKU1234567" })));
    await withTenant(t.tenantId, (tx) => createShipment(tx, ctx, shipment()));
    const find = (q: string) => withTenant(t.tenantId, (tx) => listShipments(tx, { q }));
    expect(await find("po-77")).toHaveLength(1);
    expect(await find("msku123")).toHaveLength(1);
    expect(await find("SH-00002")).toHaveLength(1);
    expect(await find("nothing")).toHaveLength(0);
  });

  it("converts an inquiry once, marks it won, and returns the same shipment the second time", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const inq = await withTenant(t.tenantId, (tx) => createInquiry(tx, { ...ctx, actorId: null, source: "FORM" }, { name: "Priya", email: "p@x.test", mode: "UNSURE", origin: "Mumbai", destination: "Dubai", cargo: "Tiles", weightKg: 500 }));
    // "Not sure yet" is never guessed: nothing is made until staff say how it is travelling.
    expect(await withTenant(t.tenantId, (tx) => createShipmentFromInquiry(tx, ctx, inq.id, "USD"))).toEqual({ needsMode: true });
    expect(await withTenant(t.tenantId, (tx) => tx.shipment.count())).toBe(0);
    const first = (await withTenant(t.tenantId, (tx) => createShipmentFromInquiry(tx, ctx, inq.id, "USD", "AIR"))) as { id: string; created: boolean };
    const second = await withTenant(t.tenantId, (tx) => createShipmentFromInquiry(tx, ctx, inq.id, "USD"));
    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    expect(await withTenant(t.tenantId, (tx) => tx.shipment.count())).toBe(1);
    expect((await withTenant(t.tenantId, (tx) => tx.inquiry.findUniqueOrThrow({ where: { id: inq.id } }))).status).toBe("WON");
    expect((await withTenant(t.tenantId, (tx) => tx.shipment.findUniqueOrThrow({ where: { id: first.id } }))).mode).toBe("AIR");
  });
});

describe("quotes", () => {
  it("stores totals, numbers per operator, and moves a new inquiry to quoted", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const inq = await withTenant(t.tenantId, (tx) => createInquiry(tx, { ...ctx, actorId: null, source: "FORM" }, { name: "Priya", email: "p@x.test", mode: "AIR", origin: "A", destination: "B", cargo: "c" }));
    const q = await withTenant(t.tenantId, (tx) => createQuote(tx, ctx, quote({ inquiryId: inq.id })));
    expect([q.quoteNo, q.subtotal, q.taxTotal, q.total]).toEqual([1, 100000, 10000, 110000]);
    expect((await withTenant(t.tenantId, (tx) => tx.inquiry.findUniqueOrThrow({ where: { id: inq.id } }))).status).toBe("QUOTED");
    expect((await withTenant(t.tenantId, (tx) => createQuote(tx, ctx, quote()))).quoteNo).toBe(2);
  });

  it("is private to its operator", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const q = await withTenant(a.tenantId, (tx) => createQuote(tx, { tenantId: a.tenantId, actorId: null }, quote()));
    expect(await withTenant(b.tenantId, (tx) => tx.quote.findUnique({ where: { id: q.id } }))).toBeNull();
    await expect(withTenant(b.tenantId, (tx) => createQuote(tx, { tenantId: a.tenantId, actorId: null }, quote()))).rejects.toThrow();
  });

  it("locks an accepted quote until it is reopened", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const q = await withTenant(t.tenantId, (tx) => createQuote(tx, ctx, quote()));
    expect((await withTenant(t.tenantId, (tx) => setQuoteStatus(tx, ctx, q.id, "ACCEPTED"))).ok).toBe(true);
    expect((await withTenant(t.tenantId, (tx) => updateQuote(tx, ctx, q.id, quote({ taxBp: 0 })))).ok).toBe(false);
    expect((await withTenant(t.tenantId, (tx) => setQuoteStatus(tx, ctx, q.id, "DRAFT"))).ok).toBe(true);
    expect((await withTenant(t.tenantId, (tx) => updateQuote(tx, ctx, q.id, quote({ taxBp: 0 })))).ok).toBe(true);
    expect((await withTenant(t.tenantId, (tx) => tx.quote.findUniqueOrThrow({ where: { id: q.id } }))).total).toBe(100000);
    expect((await withTenant(t.tenantId, (tx) => quoteCounts(tx))).DRAFT).toBe(1);
  });

  it("makes one shipment from a quote and accepts it", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const q = await withTenant(t.tenantId, (tx) => createQuote(tx, ctx, quote()));
    const first = await withTenant(t.tenantId, (tx) => createShipmentFromQuote(tx, ctx, q.id));
    const second = await withTenant(t.tenantId, (tx) => createShipmentFromQuote(tx, ctx, q.id));
    expect(first?.created).toBe(true);
    expect(second).toEqual({ id: first!.id, created: false });
    const after = await withTenant(t.tenantId, (tx) => tx.quote.findUniqueOrThrow({ where: { id: q.id } }));
    expect([after.status, after.shipmentId]).toEqual(["ACCEPTED", first!.id]);
  });
});

describe("freight invoices", () => {
  it("numbers per operator, stores totals and is private", async () => {
    const a = await makeTenant("Alpha");
    const b = await makeTenant("Bravo");
    const inv = await withTenant(a.tenantId, (tx) => createFreightInvoice(tx, { tenantId: a.tenantId, actorId: null }, invoice({ taxBp: 1000 })));
    expect([inv.invoiceNo, inv.total]).toEqual([1, 110000]);
    expect((await withTenant(b.tenantId, (tx) => createFreightInvoice(tx, { tenantId: b.tenantId, actorId: null }, invoice()))).invoiceNo).toBe(1);
    expect(await withTenant(b.tenantId, (tx) => tx.freightInvoice.findUnique({ where: { id: inv.id } }))).toBeNull();
    await expect(withTenant(b.tenantId, (tx) => createFreightInvoice(tx, { tenantId: a.tenantId, actorId: null }, invoice()))).rejects.toThrow();
  });

  it("only edits while unpaid, and tracks paid dates and receivables", async () => {
    const t = await makeTenant("Alpha");
    const ctx = { tenantId: t.tenantId, actorId: t.ownerUserId };
    const inv = await withTenant(t.tenantId, (tx) => createFreightInvoice(tx, ctx, invoice()));
    const other = await withTenant(t.tenantId, (tx) => createFreightInvoice(tx, ctx, invoice({ dueOn: "2026-06-30" })));
    expect(await withTenant(t.tenantId, (tx) => receivables(tx, "USD", "2026-06-01"))).toEqual({ count: 2, amount: 200000, overdueCount: 1, overdueAmount: 100000 });

    expect((await withTenant(t.tenantId, (tx) => setFreightInvoiceStatus(tx, ctx, inv.id, "PAID", "2026-05-20"))).ok).toBe(true);
    expect((await withTenant(t.tenantId, (tx) => tx.freightInvoice.findUniqueOrThrow({ where: { id: inv.id } }))).paidOn?.toISOString().slice(0, 10)).toBe("2026-05-20");
    expect((await withTenant(t.tenantId, (tx) => updateFreightInvoice(tx, ctx, inv.id, invoice()))).ok).toBe(false);
    expect((await withTenant(t.tenantId, (tx) => setFreightInvoiceStatus(tx, ctx, inv.id, "UNPAID", "2026-05-21"))).ok).toBe(true);
    expect((await withTenant(t.tenantId, (tx) => tx.freightInvoice.findUniqueOrThrow({ where: { id: inv.id } }))).paidOn).toBeNull();

    expect((await withTenant(t.tenantId, (tx) => setFreightInvoiceStatus(tx, ctx, other.id, "VOID", "2026-05-21"))).ok).toBe(true);
    expect((await withTenant(t.tenantId, (tx) => setFreightInvoiceStatus(tx, ctx, other.id, "UNPAID", "2026-05-21"))).ok).toBe(false);
    expect(await withTenant(t.tenantId, (tx) => freightInvoiceCounts(tx))).toEqual({ UNPAID: 1, PAID: 0, VOID: 1 });
  });
});
