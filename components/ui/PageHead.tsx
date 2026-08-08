import { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { IconButton } from "./IconButton";

interface PageHeadProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions — the view's one primary button lives here. */
  actions?: ReactNode;
  onBack?: () => void;
}

/** Content header inside a route: back affordance, eyebrow + hero title,
 * description (body copy in --ink-2), and right-aligned actions. */
export function PageHead({ eyebrow, title, description, actions, onBack }: PageHeadProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        {onBack ? <IconButton icon="back" size={36} variant="bare" label="Go back" onClick={onBack} /> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 style={{ margin: 0, font: "var(--text-hero)", letterSpacing: "var(--track-hero)", color: "var(--ink)" }}>{title}</h1>
          {description ? (
            <p style={{ margin: 0, font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 680 }}>{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto", paddingTop: 2 }}>{actions}</div> : null}
    </div>
  );
}
