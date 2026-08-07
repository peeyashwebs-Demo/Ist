import { ICON_PATHS } from "./icon-paths";

export type IconName = keyof typeof ICON_PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}

function segments(spec: string, name: string) {
  return spec.split("|").map((part, i) => {
    const key = `${name}-${i}`;
    if (part.startsWith("CIRCLE:")) {
      const [cx, cy, r] = part.slice(7).split(" ");
      return <circle key={key} cx={cx} cy={cy} r={r} />;
    }
    if (part.startsWith("RECT:")) {
      const [x, y, w, h, rx] = part.slice(5).split(" ");
      return <rect key={key} x={x} y={y} width={w} height={h} rx={rx} />;
    }
    if (part.startsWith("POLY:")) {
      return <polyline key={key} points={part.slice(5)} />;
    }
    return <path key={key} d={part} />;
  });
}

/** Kudimata line icon — 24x24 viewBox, 1.75 stroke, no fills. */
export function Icon({ name, size = 20, stroke = 1.75, color = "currentColor", className }: IconProps) {
  const spec = ICON_PATHS[name];
  if (!spec) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "block", flex: "0 0 auto" }}
      aria-hidden
    >
      {segments(spec, name)}
    </svg>
  );
}
