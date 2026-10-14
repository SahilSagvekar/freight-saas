import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { SetupStep } from "@/server/queries";

const COPY: Record<SetupStep["key"], { title: string; hint: string; href: string }> = {
  location: { title: "Add your ports", hint: "At least two: where voyages start and end.", href: "/app/settings" },
  vessel: { title: "Add a vessel", hint: "Its name and how many passengers, vehicles and cargo units it carries.", href: "/app/settings" },
  itemType: { title: "Add what you sell", hint: "Passenger, vehicle and cargo types, with prices.", href: "/app/settings" },
  voyage: { title: "Schedule your first voyage", hint: "Pick a vessel, a route and a departure time.", href: "/app/voyages/new" },
  team: { title: "Invite your team", hint: "Booking agents, dock crew and cashiers each get their own portal.", href: "/app/team" },
};

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;
  return (
    <Card className="mb-8">
      <div className="p-5">
        <h2 className="text-lg font-semibold">Get ready to sell</h2>
        <p className="mt-1 text-sm text-muted">{left === steps.length ? "Five quick steps and you are taking bookings." : `${left} of ${steps.length} steps left.`}</p>
        <ol className="mt-4 space-y-3">
          {steps.map((s) => {
            const c = COPY[s.key];
            const Icon = s.done ? CheckCircle2 : Circle;
            return (
              <li key={s.key} className="flex gap-3">
                <Icon className={s.done ? "mt-0.5 size-5 shrink-0 text-ok-700" : "mt-0.5 size-5 shrink-0 text-subtle"} aria-hidden />
                <div className="min-w-0">
                  <Link href={c.href} className={s.done ? "font-medium text-muted line-through" : "font-medium text-brand-700 hover:underline"}>{c.title}</Link>
                  {!s.done && <p className="text-sm text-muted">{c.hint}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
