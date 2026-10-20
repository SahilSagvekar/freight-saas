import { QrCode } from "@/components/qr-code";
import { cn } from "@/lib/utils";

/**
 * Miniature versions of the documents a shipment prints, drawn in HTML so they stay sharp at any size.
 * They use the same demo shipment as the hero demo (SH-00118), so the page tells one consistent story.
 */

export const DEMO = {
  shipmentNo: "SH-00118",
  inquiryNo: "INQ-00042",
  shipper: "Acme Tiles Pvt Ltd",
  shipperAddr: "Plot 14, MIDC, Navi Mumbai",
  consignee: "Al Noor Building Materials LLC",
  consigneeAddr: "Al Quoz 3, Dubai, UAE",
  from: "Nhava Sheva, India",
  to: "Jebel Ali, UAE",
  goods: "Ceramic floor tiles",
  pieces: 12,
  kg: "9,600",
  cbm: "15.84",
  container: "MSKU 482193-1",
  seal: "004417",
  hs: "6907.21",
} as const;

const sheet = "relative flex flex-col overflow-hidden rounded-[3px] bg-white text-navy-900 shadow-[0_1px_2px_rgb(10_32_54/0.08),0_6px_18px_rgb(10_32_54/0.10)] ring-1 ring-navy-900/10";

function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-navy-900/70 p-1", className)}>
      <p className="text-[5.5px] font-semibold uppercase tracking-wider text-navy-900/55">{label}</p>
      <div className="text-[7px] leading-tight">{children}</div>
    </div>
  );
}

export function MiniBol({ className }: { className?: string }) {
  return (
    <div className={cn(sheet, "aspect-[210/297] p-2.5", className)} aria-hidden>
      <div className="flex items-start justify-between border-b-2 border-navy-900 pb-1">
        <p className="text-[7px] font-bold">Your Forwarding Co.</p>
        <div className="text-right">
          <p className="text-[8px] font-bold uppercase tracking-wide">Bill of Lading</p>
          <p className="font-mono text-[7px]">{DEMO.shipmentNo}</p>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 border-l border-t border-navy-900/70 [&>*]:border-b [&>*]:border-r">
        <Cell label="Shipper">{DEMO.shipper}<br />{DEMO.shipperAddr}</Cell>
        <Cell label="B/L no.">{DEMO.shipmentNo}</Cell>
        <Cell label="Consignee">{DEMO.consignee}<br />{DEMO.consigneeAddr}</Cell>
        <Cell label="Container / seal">{DEMO.container}<br />Seal {DEMO.seal}</Cell>
        <Cell label="Port of loading">{DEMO.from}</Cell>
        <Cell label="Port of discharge">{DEMO.to}</Cell>
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_3fr_1.4fr_1.2fr] border-y-2 border-navy-900 py-0.5 text-[5.5px] font-semibold uppercase">
        <span>Pkgs</span><span>Description</span><span className="text-right">Gross</span><span className="text-right">m³</span>
      </div>
      <div className="grid grid-cols-[1fr_3fr_1.4fr_1.2fr] py-0.5 text-[7px]">
        <span>12 PLT</span><span>{DEMO.goods}<br /><span className="text-navy-900/55">HS {DEMO.hs}</span></span><span className="text-right">{DEMO.kg} kg</span><span className="text-right">{DEMO.cbm}</span>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-2">
        <div><div className="h-3 border-b border-navy-900/70" /><p className="mt-0.5 text-[5.5px] text-navy-900/55">Signed for the carrier</p></div>
        <div><div className="h-3 border-b border-navy-900/70" /><p className="mt-0.5 text-[5.5px] text-navy-900/55">Place and date of issue</p></div>
      </div>
    </div>
  );
}

export function MiniPackingList({ className }: { className?: string }) {
  const rows = [
    ["1", "6", "Pallet", "Tiles 60×60, matt", "4,800"],
    ["2", "4", "Pallet", "Tiles 30×60, gloss", "3,200"],
    ["3", "2", "Pallet", "Skirting and trims", "1,600"],
  ];
  return (
    <div className={cn(sheet, "aspect-[210/297] p-2.5", className)} aria-hidden>
      <div className="flex items-start justify-between border-b-2 border-navy-900 pb-1">
        <p className="text-[7px] font-bold">Your Forwarding Co.</p>
        <div className="text-right">
          <p className="text-[8px] font-bold uppercase tracking-wide">Packing list</p>
          <p className="font-mono text-[7px]">{DEMO.shipmentNo}</p>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 border-l border-t border-navy-900/70 [&>*]:border-b [&>*]:border-r">
        <Cell label="Shipper">{DEMO.shipper}</Cell>
        <Cell label="Consignee">{DEMO.consignee}</Cell>
      </div>
      <div className="mt-1.5 grid grid-cols-[0.6fr_0.8fr_1.4fr_3fr_1.4fr] border-y-2 border-navy-900 py-0.5 text-[5.5px] font-semibold uppercase">
        <span>#</span><span>Pcs</span><span>Type</span><span>Description</span><span className="text-right">Kg</span>
      </div>
      {rows.map((r) => (
        <div key={r[0]} className="grid grid-cols-[0.6fr_0.8fr_1.4fr_3fr_1.4fr] border-b border-navy-900/15 py-0.5 text-[7px]">
          <span className="text-navy-900/55">{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span><span>{r[3]}</span><span className="text-right">{r[4]}</span>
        </div>
      ))}
      <div className="grid grid-cols-[0.6fr_0.8fr_1.4fr_3fr_1.4fr] border-t-2 border-navy-900 py-0.5 text-[7px] font-semibold">
        <span /><span>12</span><span /><span>Total · {DEMO.cbm} m³</span><span className="text-right">{DEMO.kg}</span>
      </div>
    </div>
  );
}

export function MiniInvoice({ className }: { className?: string }) {
  const rows = [
    ["6907.21", "Tiles 60×60, matt", "6", "9,450.00"],
    ["6907.21", "Tiles 30×60, gloss", "4", "5,320.00"],
    ["6907.40", "Skirting and trims", "2", "1,030.00"],
  ];
  return (
    <div className={cn(sheet, "aspect-[210/297] p-2.5", className)} aria-hidden>
      <div className="flex items-start justify-between border-b-2 border-navy-900 pb-1">
        <p className="text-[7px] font-bold">Your Forwarding Co.</p>
        <div className="text-right">
          <p className="text-[8px] font-bold uppercase tracking-wide">Commercial invoice</p>
          <p className="font-mono text-[7px]">{DEMO.shipmentNo}</p>
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-2 border-l border-t border-navy-900/70 [&>*]:border-b [&>*]:border-r">
        <Cell label="Exporter">{DEMO.shipper}</Cell>
        <Cell label="Buyer">{DEMO.consignee}</Cell>
        <Cell label="Incoterm">FOB Nhava Sheva</Cell>
        <Cell label="Currency">USD</Cell>
      </div>
      <div className="mt-1.5 grid grid-cols-[1.4fr_3fr_0.8fr_1.6fr] border-y-2 border-navy-900 py-0.5 text-[5.5px] font-semibold uppercase">
        <span>HS code</span><span>Description</span><span className="text-right">Qty</span><span className="text-right">Value</span>
      </div>
      {rows.map((r) => (
        <div key={r[1]} className="grid grid-cols-[1.4fr_3fr_0.8fr_1.6fr] border-b border-navy-900/15 py-0.5 text-[7px]">
          <span className="font-mono">{r[0]}</span><span>{r[1]}</span><span className="text-right">{r[2]}</span><span className="text-right">{r[3]}</span>
        </div>
      ))}
      <div className="grid grid-cols-[1.4fr_3fr_0.8fr_1.6fr] border-t-2 border-navy-900 py-0.5 text-[7px] font-semibold">
        <span /><span>Total</span><span className="text-right">12</span><span className="text-right">15,800.00</span>
      </div>
    </div>
  );
}

export function MiniLabel({ n = 1, className }: { n?: number; className?: string }) {
  return (
    <div className={cn(sheet, "aspect-[100/150] p-2.5", className)} aria-hidden>
      <p className="text-[5.5px] font-semibold uppercase tracking-wider text-navy-900/55">Deliver to</p>
      <p className="text-[9px] font-bold leading-tight">{DEMO.consignee}</p>
      <p className="text-[7px] leading-tight">{DEMO.consigneeAddr}</p>
      <div className="mt-2 border-y-2 border-navy-900 py-1">
        <p className="text-[5.5px] uppercase text-navy-900/55">To</p>
        <p className="text-[12px] font-bold leading-none">Jebel Ali</p>
        <p className="mt-0.5 text-[6px] text-navy-900/55">From Nhava Sheva</p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-1 pt-2">
        <div>
          <p className="font-mono text-[9px] font-bold">{DEMO.shipmentNo}</p>
          <p className="text-[6px]">Pallet: tiles</p>
          <p className="mt-0.5 text-[16px] font-bold leading-none">{n}<span className="text-[8px] font-medium text-navy-900/55"> of {DEMO.pieces}</span></p>
        </div>
        <div className="w-[38%] shrink-0 [&>svg]:h-auto [&>svg]:w-full">
          <QrCode value={`Harborline demo label ${DEMO.shipmentNo} piece ${n}`} size={64} label="" />
        </div>
      </div>
    </div>
  );
}
