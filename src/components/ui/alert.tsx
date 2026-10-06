import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles = {
  info: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: Info },
  success: { box: "border-ok-100 bg-ok-50 text-ok-700", icon: CheckCircle2 },
  warning: { box: "border-warn-100 bg-warn-50 text-warn-700", icon: AlertTriangle },
  error: { box: "border-danger-100 bg-danger-50 text-danger-700", icon: AlertTriangle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof styles;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
    </div>
  );
}
