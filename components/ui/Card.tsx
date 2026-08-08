import { CSSProperties, ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

interface CardProps {
  /** Tertiary eyebrow line above the title. */
  eyebrow?: string;
  title?: ReactNode;
  /** Right-aligned controls in the card header row. */
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  padding?: CSSProperties["padding"];
  style?: CSSProperties;
}

/** White surface, 1px hairline, 16px radius, no shadow — the desk's basic
 * content block. Cards carry title + actions, body, and an optional footer. */
export function Card({ eyebrow, title, actions, children, footer, padding = 20, style }: CardProps) {
  return (
    <section
      style={{
        background: "var(--paper)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-card)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
    >
      {eyebrow || title ? (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "20px 20px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? (
              <h2 style={{ margin: 0, font: "var(--text-card-title)", letterSpacing: "var(--track-card-title)", color: "var(--ink)" }}>{title}</h2>
            ) : null}
          </div>
          {actions ? <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>{actions}</div> : null}
        </div>
      ) : null}
      <div style={{ padding, flex: 1 }}>{children}</div>
      {footer ? <div style={{ borderTop: "1px solid var(--hairline)", padding: "14px 20px" }}>{footer}</div> : null}
    </section>
  );
}
