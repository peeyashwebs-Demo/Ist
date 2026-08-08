function bar(width: number | string, height: number) {
  return {
    width,
    height,
    background: "var(--track)",
    borderRadius: "var(--r-chip)",
  };
}

/** Loading placeholders — recessed-track bars, no shimmer/opacity motion.
 * Rendered only while mock data "loads", so screens never flash layout. */
export function SkeletonTable({ rows = 6, cols = 5, toolbar = true }: { rows?: number; cols?: number; toolbar?: boolean }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-table)", overflow: "hidden" }}>
      {toolbar ? (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
          {[130, 96].map((w, i) => (
            <div key={i} style={bar(w, 32)} />
          ))}
        </div>
      ) : null}
      <div style={{ height: 40, padding: "0 var(--cell-pad-x)", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 24 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} style={{ ...bar(64, 10), flex: 1, maxWidth: 120 }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: "var(--row-h)", padding: "0 var(--cell-pad-x)", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 24 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} style={{ ...bar(j === 0 ? 140 : 72, 12), flex: 1, maxWidth: j === 0 ? 180 : 140 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3, header = true }: { lines?: number; header?: boolean }) {
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      {header ? <div style={bar(120, 14)} /> : null}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={bar("100%", 12)} />
      ))}
    </div>
  );
}

export function SkeletonInline({ width, height = 12 }: { width: number | string; height?: number }) {
  return <div style={bar(width, height)} />;
}
