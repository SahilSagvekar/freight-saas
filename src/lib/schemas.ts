import { z } from "zod";
import { TRANSPORT_MODES } from "./domain";
import { INCOTERMS, parseDay, SHIPMENT_MODES } from "./shipment";

/** Shared by server actions, the sync endpoint and the offline form, so all three validate identically. */
export const bookingLineSchema = z.object({
  itemTypeId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(999),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const createBookingSchema = z.object({
  voyageId: z.string().uuid("Choose a voyage"),
  contactName: z.string().trim().min(1, "Contact name is required").max(120),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  customerId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  /** Total the agent quoted while offline; if the server's price differs, the booking goes to review. */
  quotedTotal: z.number().int().min(0).optional(),
  lines: z.array(bookingLineSchema).min(1, "Add at least one item").max(50),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const syncRequestSchema = z.object({
  deviceId: z.string().min(1).max(100),
  ops: z
    .array(
      z.object({
        clientOpId: z.string().min(8).max(100),
        type: z.literal("CREATE_BOOKING"),
        payload: createBookingSchema,
      }),
    )
    .min(1)
    .max(50),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** What a visitor sends from the website form. Everything the forwarder needs for a first quote, nothing more. */
export const inquirySchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200),
  phone: optionalText(40),
  company: optionalText(120),
  mode: z.enum(TRANSPORT_MODES, { message: "Choose how you want to ship" }),
  origin: z.string().trim().min(1, "Where is it going from?").max(120),
  destination: z.string().trim().min(1, "Where is it going to?").max(120),
  cargo: z.string().trim().min(1, "Tell us what you are shipping").max(500),
  weightKg: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().positive("Weight must be more than 0").max(10_000_000).optional(),
  ),
  readyOn: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31").optional()),
  message: optionalText(2000),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

const optionalEmail = z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal(""));
const optionalDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31").refine((v) => parseDay(v) !== null, "That date doesn't exist").optional().or(z.literal(""));
const optionalNumber = (label: string, max: number) => z.number({ error: `${label} must be a number` }).positive(`${label} must be more than 0`).max(max).nullish();

export const partySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(160),
  address: z.string().trim().min(1, "Enter an address").max(500),
  phone: optionalText(60),
  email: optionalEmail,
  taxId: optionalText(60),
});

export const packageLineSchema = z.object({
  quantity: z.number({ error: "Enter how many pieces" }).int("Pieces must be a whole number").min(1, "Enter at least 1 piece").max(1_000_000),
  packageType: z.string().trim().min(1, "Choose a package type").max(40),
  description: z.string().trim().min(1, "Describe the goods").max(300),
  lengthCm: optionalNumber("Length", 100_000),
  widthCm: optionalNumber("Width", 100_000),
  heightCm: optionalNumber("Height", 100_000),
  grossWeightKg: optionalNumber("Weight", 100_000_000),
  marks: optionalText(200),
  hsCode: z.string().trim().regex(/^[0-9][0-9.\- ]{3,13}$/, "HS codes are 4 to 14 digits, like 6907.21").optional().or(z.literal("")),
  declaredValue: z.number().int().min(0).max(2_000_000_000, "That value is too large").nullish(),
});

export const shipmentSchema = z.object({
  mode: z.enum(SHIPMENT_MODES, { message: "Choose air, ocean or ground" }),
  customerRef: optionalText(80),
  shipper: partySchema,
  consignee: partySchema,
  notifyParty: partySchema.nullish(),
  origin: z.string().trim().min(1, "Where is it shipping from?").max(160),
  destination: z.string().trim().min(1, "Where is it shipping to?").max(160),
  incoterm: z.enum(INCOTERMS).optional().or(z.literal("")),
  carrier: optionalText(120),
  vesselOrFlight: optionalText(120),
  voyageNo: optionalText(60),
  masterNo: optionalText(60),
  houseNo: optionalText(60),
  containerNo: optionalText(60),
  sealNo: optionalText(60),
  etd: optionalDay,
  eta: optionalDay,
  goods: z.string().trim().min(1, "Describe the goods").max(500),
  marks: optionalText(300),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  notes: optionalText(2000),
  packages: z.array(packageLineSchema).min(1, "Add at least one package line").max(200),
});
export type ShipmentInput = z.infer<typeof shipmentSchema>;

const billLineSchema = z.object({
  description: z.string().trim().min(1, "Describe each charge").max(200),
  quantity: z.number({ error: "Quantity must be a number" }).positive("Quantity must be more than 0").max(1_000_000),
  unitPrice: z.number({ error: "Price must be a number" }).int().min(0, "Price can't be negative").max(2_000_000_000),
});

const customerFields = {
  customerName: z.string().trim().min(1, "Enter the customer's name").max(160),
  customerCompany: optionalText(160),
  customerEmail: optionalEmail,
  customerAddress: optionalText(500),
};

const billFields = {
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  taxBp: z.number().int().min(0).max(10_000),
  lines: z.array(billLineSchema).min(1, "Add at least one charge").max(60),
  notes: optionalText(2000),
};

export const quoteSchema = z.object({
  ...customerFields,
  ...billFields,
  mode: z.enum(SHIPMENT_MODES, { message: "Choose a mode" }),
  origin: z.string().trim().min(1, "Where from?").max(160),
  destination: z.string().trim().min(1, "Where to?").max(160),
  validUntil: optionalDay,
  inquiryId: z.string().uuid().nullish(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const freightInvoiceSchema = z.object({
  ...customerFields,
  ...billFields,
  reference: optionalText(120),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31").refine((v) => parseDay(v) !== null, "That date doesn't exist"),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31").refine((v) => parseDay(v) !== null, "That date doesn't exist"),
  shipmentId: z.string().uuid().nullish(),
  quoteId: z.string().uuid().nullish(),
}).refine((v) => v.dueOn >= v.issuedOn, { message: "The due date can't be before the invoice date", path: ["dueOn"] });
export type FreightInvoiceInput = z.infer<typeof freightInvoiceSchema>;
