"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, TwoLineCell, DataTableColumn } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { SearchPill } from "@/components/ui/SearchPill";
import { Select } from "@/components/ui/Select";
import { Radio } from "@/components/ui/Radio";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { PageHead } from "@/components/ui/PageHead";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/icons/Icon";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { getStaffMembers, ROLE_CARDS, CURRENT_STAFF } from "@/lib/mock/staff";
import type { StaffMember, StaffRole } from "@/types/api";

const ROLE_OPTIONS: StaffRole[] = ["Super admin", "Compliance officer", "KYC reviewer", "Support"];

// Role choices for the invite form and the edit-role picker, in the design's
// order — Support first (least privileged), Super admin last.
const ROLE_ASSIGN_OPTIONS: StaffRole[] = ["Support", "KYC reviewer", "Compliance officer", "Super admin"];

// Per-role blurb shown next to each invite radio (frame 8d) — distinct from
// ROLE_CARDS' can/cannot copy, which describes the role cards above the table.
const INVITE_ROLE_INFO: Record<StaffRole, string> = {
  Support: "Read clients, transactions and cases. Cannot decide anything.",
  "KYC reviewer": "Can override vendor KYC decisions with a logged reason.",
  "Compliance officer": "Can suspend clients and release held payouts.",
  "Super admin": "Everything, including staff and roles.",
};

const DEACTIVATE_REASON_OPTIONS = [
  { value: "Left the company", label: "Left the company" },
  { value: "Moved to another team", label: "Moved to another team" },
  { value: "Suspected credential misuse", label: "Suspected credential misuse" },
  { value: "Extended leave", label: "Extended leave" },
];

function statusTone(status: StaffMember["status"]): "approved" | "pending" | "expired" {
  return status;
}

/** Text-based diff between two ROLE_CARDS entries — what a role change grants,
 * keeps, and still withholds. Capability phrases are split on "·" since that's
 * how ROLE_CARDS packs multiple capabilities into one `can` string. */
function roleImpact(fromRole: StaffRole, toRole: StaffRole) {
  const from = ROLE_CARDS.find((r) => r.role === fromRole);
  const to = ROLE_CARDS.find((r) => r.role === toRole);
  if (!from || !to || fromRole === toRole) return null;

  const split = (s: string) => s.split("·").map((p) => p.trim()).filter(Boolean);
  const fromCan = split(from.can);
  const toCan = split(to.can);
  const gained = toCan.filter((c) => !fromCan.includes(c));
  const kept = toCan.filter((c) => fromCan.includes(c));
  const lost = fromCan.filter((c) => !toCan.includes(c));

  const parts: string[] = [];
  if (gained.length) parts.push(`Gains: ${gained.join(", ")}.`);
  if (kept.length) parts.push(`Keeps: ${kept.join(", ")}.`);
  if (lost.length) parts.push(`Loses: ${lost.join(", ")}.`);
  parts.push(`Still cannot: ${to.cannot.replace(/^Cannot /i, "").replace(/^Nothing is withheld\.?$/i, "nothing")}.`);

  return { label: `${fromRole} → ${toRole}`, summary: parts.join(" ") };
}

export default function StaffPage() {
  const mock = useMemo(() => getStaffMembers(), []);
  const [staff, setStaff] = useState<StaffMember[]>(mock);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "All roles">("All roles");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("Support");
  const [invited, setInvited] = useState<{ name: string; email: string; role: StaffRole } | null>(null);

  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState<StaffRole>("Support");
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  // Minimal state — the design's "first admin" frame (8c): only the logged-in
  // admin is on the desk. A single row is not the same as an empty table, so
  // this triggers on staff.length <= 1 (covers the true zero-row edge case too),
  // not on staff.length === 0 as the table might otherwise assume.
  const isFirstAdminOnly = staff.length <= 1;
  const soleRow = staff.length === 0 ? [CURRENT_STAFF] : staff;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      if (roleFilter !== "All roles" && s.role !== roleFilter) return false;
      if (q && !`${s.name} ${s.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staff, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const columns: DataTableColumn<StaffMember>[] = [
    { key: "name", label: "Staff", render: (r) => <TwoLineCell primary={r.name} secondary={r.email} /> },
    { key: "role", label: "Role", render: (r) => <span style={{ fontWeight: 500 }}>{r.role}</span> },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusPill status={statusTone(r.status)} label={r.statusLabel} size="sm" />,
    },
    { key: "lastSignIn", label: "Last sign-in", numeric: true, render: (r) => <span style={{ color: "var(--ink-2)" }}>{r.lastSignIn}</span> },
    { key: "addedAt", label: "Added", numeric: true, align: "right", render: (r) => <span style={{ color: "var(--ink-2)" }}>{r.addedAt}</span> },
  ];

  const openEdit = (m: StaffMember) => {
    setEditing(m);
    setEditRole(m.role);
  };

  const openDeactivate = (m: StaffMember) => {
    setDeactivating(m);
    setDeactivateReason("");
    setEditing(null);
  };

  const confirmDeactivate = () => {
    if (!deactivating) return;
    setStaff((prev) => prev.map((s) => (s.id === deactivating.id ? { ...s, status: "expired", statusLabel: "Deactivated" } : s)));
    setDeactivating(null);
  };

  const confirmEdit = () => {
    if (!editing) return;
    setStaff((prev) => prev.map((s) => (s.id === editing.id ? { ...s, role: editRole } : s)));
    setEditing(null);
  };

  const sendInvitation = () => {
    const name = inviteEmail
      .split("@")[0]
      .split(/[.\-_]/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ");
    setInvited({ name: name || inviteEmail, email: inviteEmail, role: inviteRole });
    setInviting(false);
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteRole("Support");
  };

  const inviteAnother = () => {
    setInvited(null);
    resetInviteForm();
    setInviting(true);
  };

  const backToStaff = () => {
    setInvited(null);
    resetInviteForm();
  };

  const impact = editing ? roleImpact(editing.role, editRole) : null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-section)" }}>
        <PageHead
          eyebrow="Access"
          title="Staff and roles"
          description={
            isFirstAdminOnly
              ? "You are the only account on the desk. Invite the people who will review cases and answer clients."
              : "Seven accounts. A role decides what a person can do on every other screen, so change it deliberately."
          }
        />

        {!isFirstAdminOnly && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(200px, 1fr))", gap: "var(--gap-row)" }}>
            {ROLE_CARDS.map((c) => (
              <div
                key={c.role}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-card)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--ink)", flex: 1 }}>{c.role}</span>
                  <span className="k-tnum" style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    {c.who}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <PermRow icon="check" label={c.can} />
                  <PermRow icon="minus" label={c.cannot} />
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <SkeletonTable rows={isFirstAdminOnly ? 1 : 7} cols={5} toolbar={!isFirstAdminOnly} />
        ) : isFirstAdminOnly ? (
          <DataTable columns={columns} rows={soleRow} rowKey={(r) => r.id} dense onRowClick={openEdit} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            dense
            sortKey="name"
            sortDir="asc"
            onRowClick={openEdit}
            toolbar={
              <>
                <SearchPill
                  width={260}
                  placeholder="Search name or email"
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                />
                <Select
                  height={36}
                  width={190}
                  value={roleFilter}
                  onChange={(v) => {
                    setRoleFilter(v as StaffRole | "All roles");
                    setPage(1);
                  }}
                  options={[{ value: "All roles", label: "All roles" }, ...ROLE_OPTIONS.map((r) => ({ value: r, label: r }))]}
                />
                <span style={{ flex: 1 }} />
                <Button size="sm" iconLeft="plus" onClick={() => setInviting(true)}>
                  Add staff
                </Button>
              </>
            }
            footer={
              <Pagination
                page={safePage}
                pageCount={pageCount}
                total={filtered.length}
                perPage={perPage}
                onChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                perPageOptions={[10, 25, 50]}
              />
            }
          />
        )}

        {isFirstAdminOnly && (
          <div
            style={{
              background: "var(--paper)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-card)",
              padding: "40px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              textAlign: "center",
            }}
          >
            <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>
              Invite the rest of the desk
            </span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 440 }}>
              A KYC reviewer can override vendor decisions; support can read but not decide. You keep staff management either way.
            </span>
            <div style={{ marginTop: 18 }}>
              <Button size="md" iconLeft="plus" onClick={() => setInviting(true)}>
                Add staff
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Invite flow — step 1: form (8d) */}
      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a staff member"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button
              size="md"
              iconLeft="send"
              disabled={!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())}
              onClick={sendInvitation}
            >
              Send invitation
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, font: "var(--text-body)", color: "var(--ink-2)" }}>
            They receive an email invitation and set their own password and authenticator. The account exists only once they accept.
          </p>
          <Input
            label="Work email"
            prefix={<Icon name="mail" size={16} color="var(--ink-3)" />}
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@kudimata.ng"
            hint="Must be a kudimata.ng address"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-2)" }}>
              Role
            </span>
            {ROLE_ASSIGN_OPTIONS.map((r) => (
              <Radio
                key={r}
                checked={inviteRole === r}
                onChange={() => setInviteRole(r)}
                label={r}
                description={INVITE_ROLE_INFO[r]}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="clock" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Invitation expires in 72 hours · logged against {CURRENT_STAFF.name}
            </span>
          </div>
        </div>
      </Modal>

      {/* Invite flow — step 2: confirmation (8e) */}
      <Modal open={!!invited} onClose={backToStaff} title="Invitation sent">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--status-approved-tint)",
              color: "var(--gain)",
            }}
          >
            <Icon name="check" size={22} />
          </span>
          <p style={{ margin: 0, font: "var(--text-body)", color: "var(--ink-2)", lineHeight: 1.6 }}>
            {invited?.email} has 72 hours to accept and set up their authenticator. They appear as Invited until then.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
              padding: "12px 14px",
              background: "var(--bg)",
              borderRadius: "var(--r-input)",
            }}
          >
            <span className="k-tnum" style={{ font: "var(--text-data)", letterSpacing: "var(--track-data)", color: "var(--ink)", flex: 1 }}>
              {invited?.name} · {invited?.role}
            </span>
            <StatusPill status="pending" label="Invited" size="sm" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <Button variant="secondary" size="md" fullWidth iconLeft="plus" onClick={inviteAnother}>
              Invite another
            </Button>
            <Button size="md" fullWidth onClick={backToStaff}>
              Back to staff
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit staff — change role / deactivate (8f) */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ""}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="md" onClick={confirmEdit}>
              Save role
            </Button>
          </>
        }
      >
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusPill status={statusTone(editing.status)} label={editing.statusLabel} size="sm" />
            </div>
            <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {editing.email} · added {editing.addedAt} · last sign-in {editing.lastSignIn}
            </div>
            <Select
              label="Role"
              value={editRole}
              onChange={(v) => setEditRole(v as StaffRole)}
              options={ROLE_ASSIGN_OPTIONS.map((r) => ({ value: r, label: r }))}
            />
            {impact && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: "var(--indicator-tint)", borderRadius: "var(--r-card)" }}>
                <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--indicator)" }}>
                  {impact.label}
                </span>
                <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{impact.summary}</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ font: "var(--text-card-title)", fontWeight: 500, color: "var(--ink)" }}>Deactivate account</span>
                <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>Ends access to the desk immediately.</span>
              </div>
              <Button variant="secondary" size="sm" iconLeft="lock" onClick={() => openDeactivate(editing)}>
                Deactivate
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Deactivate confirmation (8g) */}
      <Modal
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        title={`Deactivate ${deactivating?.name ?? ""}?`}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              size="md"
              disabled={!deactivateReason}
              style={{ background: deactivateReason ? "var(--loss)" : "var(--ink-3)" }}
              onClick={confirmDeactivate}
            >
              Deactivate account
            </Button>
          </>
        }
        width={520}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, font: "var(--text-body)", color: "var(--ink-2)", lineHeight: 1.6 }}>
            {deactivating?.name} is signed out of the desk immediately and cannot sign in again. Their audit history stays in
            the record.
          </p>
          <Select label="Reason" value={deactivateReason} onChange={setDeactivateReason} options={DEACTIVATE_REASON_OPTIONS} placeholder="Select a reason" />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Recorded in the audit log against {CURRENT_STAFF.name}
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PermRow({ icon, label }: { icon: "check" | "minus"; label: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ width: 14, height: 14, flex: "0 0 auto", display: "grid", placeItems: "center", marginTop: 1, color: "var(--ink-3)" }}>
        <Icon name={icon} size={14} />
      </span>
      <span style={{ font: "var(--text-data)", letterSpacing: "var(--track-data)", color: icon === "check" ? "var(--ink-2)" : "var(--ink-3)", lineHeight: 1.45 }}>
        {label}
      </span>
    </div>
  );
}
