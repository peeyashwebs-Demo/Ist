import { ReactNode } from "react";

interface PageHeadProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
}

/** Eyebrow / title / description header — the pattern used at the top of
 * every list-style screen (first built inline on the Users page). */
export function PageHead({ eyebrow, title, description }: PageHeadProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="k-eyebrow">{eyebrow}</span>
      <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: 0 }}>
        {title}
      </h1>
      {description ? (
        <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: 0 }}>{description}</p>
      ) : null}
    </div>
  );
}
