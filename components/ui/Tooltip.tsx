"use client";
import React, { useId } from "react";

// Lightweight Tooltip (no external deps)
// Usage: <Tooltip content="Texto"><button>...</button></Tooltip>
// A11y: sets aria-describedby on the child and role="tooltip" on content

type Props = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
};

export default function Tooltip({ content, children, side = "top" }: Props) {
  const id = useId();
  const positions: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <span className="relative inline-block group/tt">
      {React.cloneElement(children, {
        "aria-describedby": id,
      })}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover/tt:opacity-100 ${positions[side]}`}
      >
        {content}
      </span>
    </span>
  );
}
