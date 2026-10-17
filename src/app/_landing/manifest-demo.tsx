"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { display } from "./fonts";

type Kind = "passengers" | "vehicles" | "cargo";

type Booking = { id: string; name: string; detail: string; uses: Partial<Record<Kind, number>> };

const CAPACITY: Record<Kind, number> = { passengers: 40, vehicles: 6, cargo: 10 };
const KIND_LABEL: Record<Kind, string> = { passengers: "Passengers", vehicles: "Vehicles", cargo: "Cargo (pallets)" };
const KINDS: Kind[] = ["passengers", "vehicles", "cargo"];

const BOOKINGS: Booking[] = [
  { id: "school", name: "Palm Island school trip", detail: "24 passengers", uses: { passengers: 24 } },
  { id: "okafor", name: "Okafor family", detail: "2 adults, 1 car", uses: { passengers: 2, vehicles: 1 } },
  { id: "reyes", name: "M. Reyes", detail: "4 adults", uses: { passengers: 4 } },
  { id: "tide", name: "Tide & Co", detail: "1 van, 2 pallets", uses: { vehicles: 1, cargo: 2 } },
  { id: "coop", name: "Fish co-op", detail: "3 pallets of fish crates", uses: { cargo: 3 } },
  { id: "hartley", name: "Hartley", detail: "1 adult, 1 car", uses: { passengers: 1, vehicles: 1 } },
];

const ORANGE = "#f2733f";

/**
 * A small working copy of the product's core idea: a sailing's manifest that keeps selling when the signal drops.
 * Nothing here talks to a server. It exists so a visitor can feel the offline desk before signing up.
 */
export function ManifestDemo() {
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState<string[]>(["coop"]);
  const [walkUps, setWalkUps] = useState(0);
  const [queued, setQueued] = useState(0);
  const [synced, setSynced] = useState(0);

  const used: Record<Kind, number> = { passengers: walkUps, vehicles: 0, cargo: 0 };
  for (const b of BOOKINGS) for (const k of KINDS) used[k] += b.uses[k] ?? 0;

  const passengersFull = used.passengers >= CAPACITY.passengers;
  const allLoaded = BOOKINGS.every((b) => loaded.includes(b.id));

  function toggleSignal() {
    if (online) {
      setSynced(0);
      setOnline(false);
    } else {
      setSynced(queued);
      setQueued(0);
      setOnline(true);
    }
  }

  function sellTicket() {
    if (passengersFull) return;
    setWalkUps((n) => n + 1);
    setSynced(0);
    if (!online) setQueued((n) => n + 1);
  }

  function toggleLoaded(id: string) {
    setLoaded((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  const plural = (n: number) => (n === 1 ? "ticket" : "tickets");
  let notice: string;
  if (!online && queued > 0) notice = `${queued} ${plural(queued)} saved on this device, waiting to sync.`;
  else if (!online) notice = "No signal. Tickets you sell are saved on this device.";
  else if (synced > 0) notice = `Back online. ${synced} ${plural(synced)} synced to the manifest.`;
  else notice = "Online. Tickets go straight onto the manifest.";

  return (
    <div>
      <div
        className="overflow-hidden rounded-xl bg-navy-900 text-white shadow-pop"
        style={{ borderTop: `6px solid ${online ? "#5fd3a0" : ORANGE}` }}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="flex items-end gap-4">
            <p className={`${display.className} text-6xl font-semibold leading-[0.8] tabular-nums`}>07:30</p>
            <p className="pb-0.5 leading-tight">
              <span className="block text-lg font-medium">Harbour Town</span>
              <span className="block text-white/70">to Palm Island</span>
            </p>
          </div>
          <p
            className={`rounded-full px-3 py-1 text-sm font-semibold ${allLoaded ? "bg-[#5fd3a0] text-navy-950" : "border border-white/40 text-white"}`}
          >
            {allLoaded ? "All loaded" : "Boarding"}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-y border-white/15 px-5 py-3">
          <span id="signal-label" className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: online ? "#5fd3a0" : ORANGE }} />
            {online ? "Signal on" : "No signal"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={online}
            aria-labelledby="signal-label"
            onClick={toggleSignal}
            className="relative h-7 w-12 shrink-0 rounded-full bg-white/25 transition-colors focus-visible:outline-white aria-checked:bg-[#5fd3a0] motion-reduce:transition-none"
          >
            <span
              aria-hidden
              className={`absolute top-1 left-1 size-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${online ? "translate-x-5" : ""}`}
            />
          </button>
        </div>

        <div className="space-y-3 px-5 pt-5">
          {KINDS.map((k) => {
            const pct = Math.min(100, (used[k] / CAPACITY[k]) * 100);
            return (
              <div key={k}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{KIND_LABEL[k]}</span>
                  <span className="tabular-nums text-white/70">
                    {used[k]} of {CAPACITY[k]}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full bg-white/15"
                  role="meter"
                  aria-label={KIND_LABEL[k]}
                  aria-valuemin={0}
                  aria-valuemax={CAPACITY[k]}
                  aria-valuenow={used[k]}
                >
                  <div
                    className="h-2 rounded-full bg-white transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <ul className="mt-5 divide-y divide-white/10 border-t border-white/15">
          {BOOKINGS.map((b) => {
            const isLoaded = loaded.includes(b.id);
            return (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="block text-sm text-white/70">{b.detail}</span>
                </span>
                <button
                  type="button"
                  aria-pressed={isLoaded}
                  aria-label={`Loaded: ${b.name}`}
                  onClick={() => toggleLoaded(b.id)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-white motion-reduce:transition-none ${
                    isLoaded ? "border-[#5fd3a0] bg-[#5fd3a0] text-navy-950" : "border-white/40 text-white hover:bg-white/10"
                  }`}
                >
                  {isLoaded && <Check className="size-4" aria-hidden />}
                  Loaded
                </button>
              </li>
            );
          })}
          {walkUps > 0 && (
            <li className="flex items-center justify-between gap-3 px-5 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-medium">Walk-up tickets</span>
                <span className="block text-sm text-white/70">
                  {walkUps} {walkUps === 1 ? "adult" : "adults"}, scanned at the gangway
                </span>
              </span>
              {queued > 0 && (
                <span className="shrink-0 text-sm font-medium" style={{ color: ORANGE }}>
                  {queued} waiting to sync
                </span>
              )}
            </li>
          )}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/15 px-5 py-4">
          <button
            type="button"
            onClick={sellTicket}
            disabled={passengersFull}
            className="h-10 rounded-md bg-white px-4 text-sm font-semibold text-navy-900 transition-colors hover:bg-brand-100 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
          >
            {passengersFull ? "Passengers full" : "Sell a walk-up ticket"}
          </button>
          <p role="status" aria-live="polite" className="min-w-0 flex-1 text-sm text-white/80" style={!online ? { color: ORANGE } : undefined}>
            {notice}
          </p>
        </div>
      </div>

      <p className="mt-4 max-w-[27rem] text-sm text-muted">
        Try it: switch the signal off and sell a ticket. The desk keeps selling, and everything syncs when you&apos;re back.
      </p>
    </div>
  );
}
