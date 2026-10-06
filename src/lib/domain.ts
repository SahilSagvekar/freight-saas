// Shared domain constants and types. No imports from the database layer, so it is safe in client code.

export const ITEM_KINDS = ["PASSENGER", "VEHICLE", "CARGO"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const KIND_LABELS: Record<ItemKind, string> = {
  PASSENGER: "Passenger",
  VEHICLE: "Vehicle",
  CARGO: "Freight",
};

export const VOYAGE_STATUSES = ["SCHEDULED", "BOARDING", "DEPARTED", "ARRIVED", "CANCELLED"] as const;
export type VoyageStatus = (typeof VOYAGE_STATUSES)[number];

export const BOOKING_STATUSES = ["CONFIRMED", "NEEDS_REVIEW", "CANCELLED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const MANIFEST_STATUSES = ["PENDING", "LOADED", "UNLOADED", "DELIVERED"] as const;
export type ManifestStatus = (typeof MANIFEST_STATUSES)[number];

export const INVOICE_STATUSES = ["UNPAID", "PARTIAL", "PAID", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BOOKING_SOURCES = ["ONLINE", "OFFLINE_SYNC"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const TAX_APPLIES_TO = ["ALL", ...ITEM_KINDS] as const;
export type TaxAppliesTo = (typeof TAX_APPLIES_TO)[number];

/** A field an operator defines on an item type, e.g. "Container number" on a container. */
export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  required?: boolean;
  options?: string[];
};

export type Capacities = Record<ItemKind, number>;

/** Permission keys are fixed in code; each tenant composes its own roles from them. */
export const PERMISSIONS = {
  "booking.view": "View bookings",
  "booking.create": "Create bookings",
  "booking.cancel": "Cancel bookings",
  "booking.review": "Resolve sync conflicts",
  "voyage.manage": "Manage voyages",
  "manifest.update": "Update manifests",
  "invoice.view": "View invoices",
  "payment.record": "Record payments",
  "settings.manage": "Manage settings",
  "team.manage": "Manage team and roles",
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: { name: string; permissions: Permission[] }[] = [
  { name: "Owner", permissions: ALL_PERMISSIONS },
  {
    name: "Manager",
    permissions: [
      "booking.view",
      "booking.create",
      "booking.cancel",
      "booking.review",
      "voyage.manage",
      "manifest.update",
      "invoice.view",
      "payment.record",
    ],
  },
  { name: "Booking agent", permissions: ["booking.view", "booking.create"] },
  { name: "Dock crew", permissions: ["booking.view", "manifest.update"] },
  { name: "Cashier", permissions: ["booking.view", "invoice.view", "payment.record"] },
];

/** Default offline oversell allowance, as a percent of vessel capacity. */
export const DEFAULT_OVERSELL_PERCENT = 5;
