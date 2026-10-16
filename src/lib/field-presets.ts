import type { FieldDef, ItemKind } from "./domain";

/** Details an operator can switch on per item type. Keys are stable: reports and waybills read them (`weight`). */
export const FIELD_PRESETS: Record<ItemKind, FieldDef[]> = {
  PASSENGER: [
    { key: "full_name", label: "Full name", type: "text" },
    { key: "id_number", label: "ID or passport number", type: "text" },
  ],
  VEHICLE: [
    { key: "plate", label: "Plate number", type: "text", required: true },
    { key: "driver_name", label: "Driver name", type: "text" },
  ],
  CARGO: [
    { key: "contents", label: "Contents", type: "text", required: true },
    { key: "weight", label: "Weight (kg)", type: "number" },
    { key: "consignee", label: "Consignee (who receives it)", type: "text" },
    { key: "consignee_phone", label: "Consignee phone", type: "text" },
    { key: "fragile", label: "Fragile", type: "boolean" },
    { key: "dangerous", label: "Dangerous goods", type: "boolean" },
  ],
};

/**
 * The schema to store when the operator ticks `selected` presets. Fields the operator defined some other way
 * (not in the presets) are kept, and presets keep their order.
 */
export function buildFieldSchema(kind: ItemKind, selected: string[], existing: FieldDef[]): FieldDef[] {
  const presets = FIELD_PRESETS[kind];
  const presetKeys = new Set(presets.map((p) => p.key));
  const chosen = presets.filter((p) => selected.includes(p.key));
  const custom = existing.filter((f) => !presetKeys.has(f.key));
  return [...chosen, ...custom];
}
