import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StatTone = "default" | "good" | "warn" | "bad";

const TONE_CLASS: Record<StatTone, string> = {
  default: "",
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
};

/** Compact KPI tile used across the back-office pages. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}>{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
