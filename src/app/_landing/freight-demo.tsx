"use client";

import { ArrowRight, Check, Globe, Plane, RotateCcw, Ship, Truck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { display } from "./fonts";
import type { ShipmentMode } from "@/lib/shipment";
import { DEMO, DEMO_JOBS, MiniBol, MiniLabel, MiniPackingList } from "./mini-docs";

const STEPS = ["Inquiry", "Shipment", "Documents", "Tracking"] as const;
const STATUSES = ["Booked", "Picked up", "In transit", "Arrived", "Cleared", "Delivered"] as const;
const MODE_TABS = [
  { mode: "AIR", label: "Air", Icon: Plane },
  { mode: "OCEAN", label: "Ocean", Icon: Ship },
  { mode: "GROUND", label: "Road", Icon: Truck },
] as const satisfies readonly { mode: ShipmentMode; label: string; Icon: unknown }[];

/**
 * A small, self-contained walk through the product's core idea: one record, typed once, carries a job from a website
 * inquiry to the documents and the customer's tracking page. Nothing here talks to a server.
 */
export function FreightDemo() {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(2);
  const [mode, setMode] = useState<ShipmentMode>("AIR");
  const job = DEMO_JOBS[mode];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const reset = () => {
    setStep(0);
    setStatus(2);
  };

  return (
    <div className="relative min-w-0">
      <div className="rounded-xl bg-white shadow-[0_1px_2px_rgb(10_32_54/0.06),0_24px_48px_-12px_rgb(10_32_54/0.22)] ring-1 ring-navy-900/10">
        <div className="flex items-center justify-between gap-3 border-b border-navy-900/10 px-4 py-2.5">
          <span className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-navy-900/15" />
            <span className="size-2.5 rounded-full bg-navy-900/15" />
            <span className="size-2.5 rounded-full bg-navy-900/15" />
          </span>
          <span className="text-xs font-medium text-muted">Interactive demo · sample data</span>
        </div>

        <div role="tablist" aria-label="Mode of transport" className="grid grid-cols-3 gap-1 border-b border-navy-900/10 p-1.5">
          {MODE_TABS.map(({ mode: m, label, Icon }) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setStatus(2); }}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors motion-reduce:transition-none",
                mode === m ? "bg-navy-900 text-white" : "text-navy-900/70 hover:bg-navy-900/5 hover:text-navy-900",
              )}
            >
              <Icon className="size-4" aria-hidden />{label}
            </button>
          ))}
        </div>

        <ol className="grid grid-cols-4 border-b border-navy-900/10" aria-label="Demo steps">
          {STEPS.map((label, i) => (
            <li key={label} className="min-w-0">
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                className={cn(
                  "relative flex w-full flex-col items-start gap-0.5 px-2 py-2.5 text-left sm:px-3 transition-colors motion-reduce:transition-none",
                  step === i ? "text-navy-900" : i < step ? "text-navy-900/70 hover:text-navy-900" : "text-navy-900/40 hover:text-navy-900/70",
                )}
              >
                <span className="font-mono text-[10px] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className={`${display.className} max-w-full truncate text-[15px] font-semibold sm:text-lg`}>{label}</span>
                <span aria-hidden className={cn("absolute inset-x-0 bottom-0 h-0.5 transition-colors motion-reduce:transition-none", step === i ? "bg-[#f2733f]" : "bg-transparent")} />
              </button>
            </li>
          ))}
        </ol>

        <div className="min-h-[24rem] p-5 sm:p-6" aria-live="polite">
          {step === 0 && (
            <div key="inq" className="demo-in flex h-full flex-col gap-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Globe className="size-3.5" aria-hidden />
                From the quote form on your website · 2 minutes ago
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className={`${display.className} text-3xl font-semibold leading-none`}>{DEMO.inquiryNo}</p>
                <span className="rounded-full bg-[#fde3d6] px-2.5 py-0.5 text-xs font-semibold text-[#9a3a12]">New</span>
              </div>
              <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted">From</dt><dd>Priya Shah, {DEMO.shipper}</dd>
                <dt className="text-muted">Mode</dt><dd>{job.inquiryMode}</dd>
                <dt className="text-muted">Route</dt><dd>{job.from} → {job.to}</dd>
                <dt className="text-muted">Cargo</dt><dd>{job.cargoLine}</dd>
                <dt className="text-muted">Weight</dt><dd className="tabular-nums">{job.kg} kg</dd>
                <dt className="text-muted">Ready</dt><dd>3 November</dd>
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                <DemoButton onClick={next}>Convert to shipment</DemoButton>
                <span className="text-xs text-muted">Or price it as a quote first.</span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div key="sh" className="demo-in flex h-full flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className={`${display.className} text-3xl font-semibold leading-none`}>{DEMO.shipmentNo}</p>
                <span className="rounded-full bg-navy-900/8 px-2.5 py-0.5 text-xs font-semibold">Booked</span>
              </div>
              <p className="-mt-2 text-xs text-muted">Filled in from {DEMO.inquiryNo}. Add the rest once, here.</p>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Party label="Shipper" name={DEMO.shipper} addr={DEMO.shipperAddr} />
                <Party label="Consignee" name={DEMO.consignee} addr={DEMO.consigneeAddr} />
              </div>
              <div className="rounded-md bg-[#f1f3f0] p-3 text-sm">
                <p className="font-medium">12 × {job.unit} · {job.size}</p>
                <p className="mt-0.5 text-xs text-muted tabular-nums">{job.kg} kg gross · {job.cbm} m³ · HS {job.hs} · {job.conveyance.join(" · ")}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                <DemoButton onClick={next}>Print documents</DemoButton>
                <span className="text-xs text-muted">Nothing above is typed again.</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div key="docs" className="demo-in flex h-full flex-col gap-4">
              <p className="text-sm text-muted">Same record, three documents, worded for the mode you picked. Each prints or saves as a PDF.</p>
              <div className="grid grid-cols-[1fr_1fr_0.72fr] items-end gap-3">
                <MiniBol mode={mode} />
                <MiniPackingList mode={mode} />
                <MiniLabel n={3} mode={mode} />
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                <DemoButton onClick={next}>Track it</DemoButton>
                <span className="text-xs text-muted">One label per piece, each with a QR code.</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div key="trk" className="demo-in flex h-full flex-col gap-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-muted">What your customer sees at the tracking link</p>
                <span className="rounded-full bg-[#fde3d6] px-2.5 py-0.5 text-xs font-semibold text-[#9a3a12]">{STATUSES[status]}</span>
              </div>
              <ol className="relative flex flex-col gap-2.5 pl-6">
                <span aria-hidden className="absolute bottom-1.5 left-[7px] top-1.5 w-px bg-navy-900/15" />
                {STATUSES.map((s, i) => (
                  <li key={s} className={cn("relative text-sm", i > status && "text-navy-900/35")}>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -left-6 top-0.5 flex size-[15px] items-center justify-center rounded-full border",
                        i < status ? "border-navy-900 bg-navy-900 text-white" : i === status ? "border-[#f2733f] bg-[#f2733f] text-white" : "border-navy-900/25 bg-white",
                      )}
                    >
                      {i < status && <Check className="size-2.5" strokeWidth={3} />}
                    </span>
                    <span className="font-medium">{s}</span>
                    {i <= status && job.places[i] && <span className="text-muted"> · {job.places[i]}</span>}
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                {status < STATUSES.length - 1 ? (
                  <DemoButton onClick={() => setStatus((s) => s + 1)}>Mark {STATUSES[status + 1]!.toLowerCase()}</DemoButton>
                ) : (
                  <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-md border border-navy-900/25 px-4 text-sm font-medium hover:bg-navy-900/5">
                    <RotateCcw className="size-4" aria-hidden />Start over
                  </button>
                )}
                <span className="text-xs text-muted">Optionally emails the customer on each change.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DemoButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex h-10 items-center gap-2 rounded-md bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 motion-reduce:transition-none"
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
    </button>
  );
}

function Party({ label, name, addr }: { label: string; name: string; addr: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 font-medium">{name}</p>
      <p className="text-xs text-muted">{addr}</p>
    </div>
  );
}
