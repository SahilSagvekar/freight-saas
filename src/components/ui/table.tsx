import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A scroll-safe table: wide tables scroll sideways inside the card instead of breaking the page on phones. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full min-w-[34rem] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export const Th = ({ className, ...props }: ComponentProps<"th">) => (
  <th
    className={cn("border-b border-line bg-canvas/60 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted", className)}
    {...props}
  />
);

export const Td = ({ className, ...props }: ComponentProps<"td">) => (
  <td className={cn("border-b border-line px-4 py-3 align-middle text-ink", className)} {...props} />
);

export const Tr = ({ className, ...props }: ComponentProps<"tr">) => (
  <tr className={cn("transition-colors last:[&>td]:border-b-0 hover:bg-canvas/50", className)} {...props} />
);
