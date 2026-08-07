"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { NAV_SECTIONS } from "@/components/shell/nav-config";

/** 236px fixed sidebar — Wordmark, then the desk's nav sections. Active item
 * gets the purple tint + 600-weight treatment. */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: "var(--sidenav-w)",
        flex: "0 0 auto",
        height: "100%",
        background: "var(--paper)",
        borderRight: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 12px",
        gap: 28,
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
        <Image src="/brand/kudimata-mark.svg" alt="" width={26} height={30} priority />
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.17px", color: "var(--ink)", whiteSpace: "nowrap" }}>
          Kudimata <span style={{ fontWeight: 400, color: "var(--ink-2)" }}>Securities</span>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {section.label ? (
              <span
                style={{
                  font: "var(--text-label)",
                  letterSpacing: "var(--track-label)",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                  padding: "0 8px",
                  marginBottom: 6,
                }}
              >
                {section.label}
              </span>
            ) : null}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    height: 38,
                    padding: "0 8px",
                    borderRadius: "var(--r-input)",
                    background: active ? "var(--indicator-tint)" : "transparent",
                    color: active ? "var(--indicator)" : "var(--ink-2)",
                  }}
                >
                  <Icon name={item.icon} size={18} color={active ? "var(--indicator)" : "var(--ink-3)"} />
                  <span style={{ font: "var(--text-body)", fontWeight: active ? 600 : 500, flex: 1 }}>{item.label}</span>
                  {item.count != null ? (
                    <span className="k-tnum" style={{ font: "var(--text-micro)", color: active ? "var(--indicator)" : "var(--ink-3)" }}>
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
