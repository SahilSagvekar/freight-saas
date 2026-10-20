import { toMinor, fromMinor } from "./money";
import { isShipmentMode, type Party } from "./shipment";

/** The shipment form keeps everything as text while a person types, and converts once on save. */
export type PartyForm = { name: string; address: string; phone: string; email: string; taxId: string };
export type PackageForm = { key: number; quantity: string; packageType: string; description: string; length: string; width: string; height: string; weight: string; marks: string; hsCode: string; value: string };
export type ShipmentForm = {
  mode: string;
  customerRef: string;
  shipper: PartyForm;
  consignee: PartyForm;
  notify: PartyForm;
  origin: string;
  destination: string;
  incoterm: string;
  carrier: string;
  vesselOrFlight: string;
  voyageNo: string;
  masterNo: string;
  houseNo: string;
  containerNo: string;
  sealNo: string;
  etd: string;
  eta: string;
  goods: string;
  marks: string;
  notes: string;
  packages: PackageForm[];
};

export const emptyParty = (): PartyForm => ({ name: "", address: "", phone: "", email: "", taxId: "" });
export const emptyPackage = (key: number): PackageForm => ({ key, quantity: "1", packageType: "Pallet", description: "", length: "", width: "", height: "", weight: "", marks: "", hsCode: "", value: "" });

/** `mode` starts empty on purpose: a person chooses air, ocean or road, nothing is assumed for them. */
export const emptyShipmentForm = (): ShipmentForm => ({
  mode: "",
  customerRef: "",
  shipper: emptyParty(),
  consignee: emptyParty(),
  notify: emptyParty(),
  origin: "",
  destination: "",
  incoterm: "",
  carrier: "",
  vesselOrFlight: "",
  voyageNo: "",
  masterNo: "",
  houseNo: "",
  containerNo: "",
  sealNo: "",
  etd: "",
  eta: "",
  goods: "",
  marks: "",
  notes: "",
  packages: [emptyPackage(1)],
});

/** Text → number. Blank is "not given" (null); anything that isn't a number becomes NaN so validation can say so. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (t === "") return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

const partyFromForm = (p: PartyForm) => ({ name: p.name, address: p.address, phone: p.phone, email: p.email, taxId: p.taxId });
const partyIsBlank = (p: PartyForm) => !p.name.trim() && !p.address.trim() && !p.phone.trim() && !p.email.trim() && !p.taxId.trim();

/**
 * What the form sends to the server. A package value that can't be read as money is reported here, because
 * the server only ever sees whole minor units. A notify party with nothing in it is left out.
 */
export function toShipmentPayload(form: ShipmentForm, currency: string): { payload: Record<string, unknown>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const packages = form.packages.map((p, i) => {
    let declaredValue: number | null = null;
    if (p.value.trim() !== "") {
      declaredValue = toMinor(p.value, currency);
      if (declaredValue === null) errors[`packages.${i}.declaredValue`] = "Enter a value like 120.50";
    }
    return {
      quantity: parseNumber(p.quantity) ?? Number.NaN,
      packageType: p.packageType,
      description: p.description,
      lengthCm: parseNumber(p.length),
      widthCm: parseNumber(p.width),
      heightCm: parseNumber(p.height),
      grossWeightKg: parseNumber(p.weight),
      marks: p.marks,
      hsCode: p.hsCode,
      declaredValue,
    };
  });
  if (!isShipmentMode(form.mode)) errors.mode = "Choose air, ocean or road";
  return {
    errors,
    payload: {
      mode: form.mode,
      customerRef: form.customerRef,
      shipper: partyFromForm(form.shipper),
      consignee: partyFromForm(form.consignee),
      notifyParty: partyIsBlank(form.notify) ? null : partyFromForm(form.notify),
      origin: form.origin,
      destination: form.destination,
      incoterm: form.incoterm,
      carrier: form.carrier,
      vesselOrFlight: form.vesselOrFlight,
      voyageNo: form.voyageNo,
      masterNo: form.masterNo,
      houseNo: form.houseNo,
      containerNo: form.containerNo,
      sealNo: form.sealNo,
      etd: form.etd,
      eta: form.eta,
      goods: form.goods,
      marks: form.marks,
      currency,
      notes: form.notes,
      packages,
    },
  };
}

type ShipmentRow = {
  mode: string;
  customerRef: string | null;
  shipper: unknown;
  consignee: unknown;
  notifyParty: unknown;
  origin: string;
  destination: string;
  incoterm: string | null;
  carrier: string | null;
  vesselOrFlight: string | null;
  voyageNo: string | null;
  masterNo: string | null;
  houseNo: string | null;
  containerNo: string | null;
  sealNo: string | null;
  etd: Date | null;
  eta: Date | null;
  goods: string;
  marks: string | null;
  notes: string | null;
  currency: string;
  packages: { quantity: number; packageType: string; description: string; lengthCm: number | null; widthCm: number | null; heightCm: number | null; grossWeightKg: number | null; marks: string | null; hsCode: string | null; declaredValue: number | null }[];
};

const party = (json: unknown): PartyForm => {
  const p = (json ?? {}) as Partial<Party>;
  return { name: p.name ?? "", address: p.address ?? "", phone: p.phone ?? "", email: p.email ?? "", taxId: p.taxId ?? "" };
};
const text = (n: number | null) => (n === null ? "" : String(n));

/** A saved shipment as the edit form shows it. */
export function formFromShipment(s: ShipmentRow): ShipmentForm {
  return {
    mode: s.mode,
    customerRef: s.customerRef ?? "",
    shipper: party(s.shipper),
    consignee: party(s.consignee),
    notify: party(s.notifyParty),
    origin: s.origin,
    destination: s.destination,
    incoterm: s.incoterm ?? "",
    carrier: s.carrier ?? "",
    vesselOrFlight: s.vesselOrFlight ?? "",
    voyageNo: s.voyageNo ?? "",
    masterNo: s.masterNo ?? "",
    houseNo: s.houseNo ?? "",
    containerNo: s.containerNo ?? "",
    sealNo: s.sealNo ?? "",
    etd: s.etd ? s.etd.toISOString().slice(0, 10) : "",
    eta: s.eta ? s.eta.toISOString().slice(0, 10) : "",
    goods: s.goods,
    marks: s.marks ?? "",
    notes: s.notes ?? "",
    packages: s.packages.length
      ? s.packages.map((p, i) => ({
          key: i + 1,
          quantity: String(p.quantity),
          packageType: p.packageType,
          description: p.description,
          length: text(p.lengthCm),
          width: text(p.widthCm),
          height: text(p.heightCm),
          weight: text(p.grossWeightKg),
          marks: p.marks ?? "",
          hsCode: p.hsCode ?? "",
          value: p.declaredValue === null ? "" : fromMinor(p.declaredValue, s.currency),
        }))
      : [emptyPackage(1)],
  };
}
