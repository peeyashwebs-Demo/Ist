import { ReactNode } from "react";

/** Uppercase, tracked, tertiary label — the "eyebrow" above a page or card title. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="k-eyebrow" style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
      {children}
    </span>
  );
}
