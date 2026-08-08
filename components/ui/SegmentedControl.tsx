"use client";

interface SegmentedControlProps<T extends string> {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  /** Uppercase label-role label to the left of the segments. */
  label?: string;
}

/** Segmented filter row — recessed track, the active segment carries the
 * purple tint (the view's "selected chip"). */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {label ? (
        <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      ) : null}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          padding: 3,
          background: "var(--track)",
          borderRadius: "var(--r-segment)",
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              style={{
                height: 28,
                padding: "0 12px",
                border: "none",
                borderRadius: "calc(var(--r-segment) - 2px)",
                background: active ? "var(--indicator-tint)" : "transparent",
                color: active ? "var(--indicator)" : "var(--ink-3)",
                font: "var(--text-label)",
                letterSpacing: "var(--track-label)",
                textTransform: "uppercase",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                transition: "background var(--dur-fast) var(--ease-soft), color var(--dur-fast) var(--ease-soft)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
