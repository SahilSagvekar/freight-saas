import { parseCsv } from "./csv-parse";
import { toMinor } from "./money";
import { shipmentSchema, type ShipmentInput } from "./schemas";
import { PACKAGE_TYPES } from "./shipment";

export const IMPORT_MAX_ROWS = 200;

/** Column names, in the order the template shows them. Required ones first. */
export const IMPORT_COLUMNS = [
  "origin", "destination", "goods", "shipper_name", "shipper_address", "consignee_name", "consignee_address",
  "mode", "customer_ref", "incoterm", "carrier", "container_no", "house_no", "master_no", "etd", "eta",
  "pieces", "package_type", "weight_kg", "length_cm", "width_cm", "height_cm", "hs_code", "value",
] as const;
const REQUIRED = ["origin", "destination", "goods", "shipper_name", "shipper_address", "consignee_name", "consignee_address", "mode"] as const;

export const importTemplateRows = (): string[][] => [
  [...IMPORT_COLUMNS],
  ["Shanghai", "Rotterdam", "Ceramic tiles", "Acme Ltd", "1 Export Road, Shanghai", "Bolt BV", "2 Havenstraat, Rotterdam", "ocean", "PO-1001", "FOB", "", "", "", "", "2026-11-03", "2026-12-10", "20", "Pallet", "12400", "120", "100", "110", "6907.21", "15800.00"],
];

const MODE_ALIASES: Record<string, string> = { ocean: "OCEAN", sea: "OCEAN", air: "AIR", "air freight": "AIR", "ocean freight": "OCEAN", "road freight": "GROUND", ground: "GROUND", road: "GROUND", truck: "GROUND" };

export type ImportResult = { shipments: ShipmentInput[]; errors: string[] };

/** Turns an uploaded CSV into validated shipments. One row is one shipment with one package line. All-or-nothing is the caller's choice: errors are listed per row. */
export function readShipmentCsv(text: string, currency: string): ImportResult {
  const table = parseCsv(text);
  if (table.length < 2) return { shipments: [], errors: ["The file has no rows. Download the template and fill it in."] };
  const header = table[0]!.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) return { shipments: [], errors: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template for the right headings.`] };
  const body = table.slice(1);
  if (body.length > IMPORT_MAX_ROWS) return { shipments: [], errors: [`That file has ${body.length} rows. Import up to ${IMPORT_MAX_ROWS} at a time.`] };

  const shipments: ShipmentInput[] = [];
  const errors: string[] = [];
  body.forEach((cells, idx) => {
    const line = idx + 2; // line number as the spreadsheet shows it
    const get = (name: string) => (cells[header.indexOf(name)] ?? "").trim();
    const num = (name: string): number | null | "bad" => {
      const v = get(name).replace(/,/g, "");
      if (v === "") return null;
      return /^\d+(\.\d+)?$/.test(v) ? Number(v) : "bad";
    };
    const problems: string[] = [];
    const n = (name: string) => {
      const v = num(name);
      if (v === "bad") {
        problems.push(`${name} must be a number`);
        return null;
      }
      return v;
    };
    const modeText = get("mode").toLowerCase();
    // A blank mode is an error, not "ocean": the row is rejected with "Choose air, ocean or road".
    const mode = modeText === "" ? "" : MODE_ALIASES[modeText] ?? get("mode").toUpperCase();
    const typeText = get("package_type");
    const packageType = typeText === "" ? "Other" : PACKAGE_TYPES.find((t) => t.toLowerCase() === typeText.toLowerCase()) ?? "Other";
    let declaredValue: number | null = null;
    if (get("value") !== "") {
      declaredValue = toMinor(get("value"), currency);
      if (declaredValue === null) problems.push("value must be an amount like 120.50");
    }
    const pieces = get("pieces") === "" ? 1 : n("pieces");
    const raw = {
      mode,
      customerRef: get("customer_ref"),
      shipper: { name: get("shipper_name"), address: get("shipper_address"), phone: "", email: "", taxId: "" },
      consignee: { name: get("consignee_name"), address: get("consignee_address"), phone: "", email: "", taxId: "" },
      notifyParty: null,
      origin: get("origin"),
      destination: get("destination"),
      incoterm: get("incoterm").toUpperCase(),
      carrier: get("carrier"),
      vesselOrFlight: "",
      voyageNo: "",
      masterNo: get("master_no"),
      houseNo: get("house_no"),
      containerNo: get("container_no"),
      sealNo: "",
      etd: get("etd"),
      eta: get("eta"),
      goods: get("goods"),
      marks: "",
      currency,
      notes: "",
      packages: [{ quantity: pieces ?? Number.NaN, packageType, description: get("goods").slice(0, 300), lengthCm: n("length_cm"), widthCm: n("width_cm"), heightCm: n("height_cm"), grossWeightKg: n("weight_kg"), marks: "", hsCode: get("hs_code"), declaredValue }],
    };
    if (problems.length) {
      errors.push(`Row ${line}: ${problems.join("; ")}`);
      return;
    }
    const parsed = shipmentSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.length ? ` (${issue.path.join(" ")})` : "";
      errors.push(`Row ${line}: ${issue?.message ?? "not valid"}${where}`);
      return;
    }
    shipments.push(parsed.data);
  });
  return { shipments, errors };
}
