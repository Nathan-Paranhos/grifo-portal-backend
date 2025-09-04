"use client";
import React from "react";

type Tone = "amber" | "blue" | "emerald" | "rose" | "zinc";

export function StatusBadge({
  tone = "zinc",
  leftIcon,
  children,
  className = "",
}: {
  tone?: Tone;
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const toneMap: Record<Tone, string> = {
    amber: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    blue: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    rose: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    zinc: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/30",
  };
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium leading-none",
        toneMap[tone],
        className,
      ].join(" ")}
    >
      {leftIcon}
      {children}
    </span>
  );
}
