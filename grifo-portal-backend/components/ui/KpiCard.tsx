import React from "react";

type Props = {
  label: string;
  value: React.ReactNode;
  delta?: number;
  icon?: React.ReactNode;
  color?: string; // used for sparkline tint
  children?: React.ReactNode; // optional sparkline/content slot
};

export default function KpiCard({ label, value, delta, icon, color, children }: Props) {
  return (
    <div className="rounded-xl border border-border p-4 bg-gradient-to-b from-card/80 to-card/40">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        {icon && (
          <div className="h-8 w-8 grid place-items-center rounded-md border border-border text-muted-foreground/90" aria-hidden>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {typeof delta === "number" && (
          <div
            className={`text-xs px-1.5 py-0.5 rounded border ${
              delta >= 0
                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                : "border-rose-500/30 text-rose-400 bg-rose-500/10"
            }`}
            aria-label={`Variação ${delta >= 0 ? "+" : ""}${delta}%`}
          >
            {delta >= 0 ? "+" : ""}
            {delta}%
          </div>
        )}
      </div>
      {children ? (
        <div className="mt-3" style={color ? ({ color } as React.CSSProperties) : undefined}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
