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
import { listStaffMembers, inviteStaffMember, updateStaffRole, deactivateStaffMember, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import type { ApiStaffMember, ApiStaffRole, ApiStaffStatus } from "@/lib/api/types";

const ROLE_LABEL: Record<ApiStaffRole, string> = {
  support: "Support",
  kyc_reviewer: "KYC reviewer",
  compliance_officer: "Compliance officer",
  super_admin: "Super admin",
};

// Role filter options (alphabetical, matching the mock) and the invite/edit
// picker order from the design — Support first (least privileged), Super
// admin last.
const ROLE_OPTIONS: ApiStaffRole[] = ["super_admin", "compliance_officer", "kyc_reviewer", "support"];
const ROLE_ASSIGN_OPTIONS: ApiStaffRole[] = ["support", "kyc_reviewer", "compliance_officer", "super_admin"];

// Per-role blurb shown next to each invite radio (frame 8d) — distinct from
// ROLE_CARDS' can/cannot copy, which describes the role cards above the table.
const INVITE_ROLE_INFO: Record<ApiStaffRole, string> = {
  support: "Read clients, transactions and cases. Cannot decide anything.",
  kyc_reviewer: "Can override vendor KYC decisions with a logged reason.",
  compliance_officer: "Can suspend clients and release held payouts.",
  super_admin: "Everything, including staff and roles.",
};

const DEACTIVATE_REASON_OPTIONS = [
  { value: "Left the company", label: "Left the company" },
  { value: "Moved to another team", label: "Moved to another team" },
  { value: "Suspected credential misuse", label: "Suspected credential misuse" },
  { value: "Extended leave", label: "Extended leave" },
];

const STATUS_LABEL: Record<ApiStaffStatus, string> = {
  approved: "Active",
  pending: "Invited",
  expired: "Deactivated",
};

// Capability cards above the table (frame 8b) — copy fixed by the design, but
// the "who" count is derived live from the fetched roster.
const ROLE_CARDS: Array<{ role: ApiStaffRole; can: string; cannot: string }> = [
  { role: "super_admin", can: "Everything, including staff and roles", cannot: "Nothing is withheld" },
  { role: "compliance_officer", can: "Suspend and enable clients · release payouts", cannot: "Cannot manage staff" },
  { role: "kyc_reviewer", can: "Override KYC decisions · read the audit log", cannot: "Cannot suspend clients or manage staff" },
  { role: "support", can: "Read clients, transactions and cases", cannot: "Cannot decide, suspend or release anything" },
];

function fmtDate(iso: string | null, fallback: string) {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Text-based diff between two ROLE_CARDS entries — what a role change grants,
 * keeps, and still withholds. Capability phrases are split on "·" since that's
 * how ROLE_CARDS packs multiple capabilities into one `can` string. */
function roleImpact(fromRole: ApiStaffRole, toRole: ApiStaffRole) {
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

  return { label: `${ROLE_LABEL[fromRole]} → ${ROLE_LABEL[toRole]}`, summary: parts.join(" ") };
}

export default function StaffPage() {
  const { session } = useAuth();

  const [staff, setStaff] = useState<ApiStaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ApiStaffRole | "All roles">("All roles");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ApiStaffRole>("support");
  const [invited, setInvited] = useState<ApiStaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<ApiStaffMember | null>(null);
  const [editRole, setEditRole] = useState<ApiStaffRole>("support");

  const [deactivating, setDeactivating] = useState<ApiStaffMember | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listStaffMembers({ page: 1, pageSize: 100 })
      .then((res) => {
        if (cancelled) return;
        setStaff(res.data);
        setTotal(res.meta.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load staff.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentStaff = useMemo(() => staff.find((s) => s.id === session?.staffId) ?? null, [staff, session]);
  const currentName = currentStaff?.name ?? "the signed-in admin";

  // Minimal state — the design's "first admin" frame (8c): only the logged-in
  // admin is on the desk. A single row is not the same as an empty table.
  const isFirstAdminOnly = total <= 1;

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
  const soleRow = rows.length ? rows : currentStaff ? [currentStaff] : [];

  const roleWho = (role: ApiStaffRole) => {
    const n = staff.filter((s) => s.role === role && s.status !== "expired").length;
    return n === 1 ? "1 person" : `${n} people`;
  };

  const columns: DataTableColumn<ApiStaffMember>[] = [
    { key: "name", label: "Staff", render: (r) => <TwoLineCell primary={r.name} secondary={r.email} /> },
    { key: "role", label: "Role", render: (r) => <span style={{ fontWeight: 500 }}>{ROLE_LABEL[r.role]}</span> },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusPill status={r.status} label={STATUS_LABEL[r.status]} size="sm" />,
    },
    { key: "lastSignIn", label: "Last sign-in", numeric: true, render: (r) => <span style={{ color: "var(--ink-2)" }}>{fmtDate(r.lastSignIn, "Never")}</span> },
    { key: "addedAt", label: "Added", numeric: true, align: "right", render: (r) => <span style={{ color: "var(--ink-2)" }}>{fmtDate(r.addedAt, "—")}</span> },
  ];

  const openEdit = (m: ApiStaffMember) => {
    setActionError(null);
    setEditing(m);
    setEditRole(m.role);
  };

  const openDeactivate = (m: ApiStaffMember) => {
    setActionError(null);
    setDeactivating(m);
    setDeactivateReason("");
    setEditing(null);
  };

  const confirmDeactivate = async () => {
    if (!deactivating) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await deactivateStaffMember(deactivating.id, deactivateReason);
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setDeactivating(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't deactivate this account.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEdit = async () => {
    if (!editing) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await updateStaffRole(editing.id, editRole);
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditing(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't save this role change.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendInvitation = async () => {
    setSubmitting(true);
    setActionError(null);
    const name = inviteEmail
      .split("@")[0]
      .split(/[.\-_]/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ");
    try {
      const created = await inviteStaffMember(name || inviteEmail, inviteEmail, inviteRole);
      setStaff((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setInvited(created);
      setInviting(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't send the invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteRole("support");
    setActionError(null);
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-section)" }}>
      <PageHead
        eyebrow="Access"
        title="Staff and roles"
        description={
          isFirstAdminOnly
            ? "You are the only account on the desk. Invite the people who will review cases and answer clients."
            : `${total.toLocaleString()} ${total === 1 ? "account" : "accounts"}. A role decides what a person can do on every other screen, so change it deliberately.`
        }
      />

      {loadError ? (
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)" }}>
          <span style={{ font: "var(--text-section)", letterSpacing: "var(--track-section)", color: "var(--ink)" }}>Couldn&apos;t load staff</span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>{loadError}</span>
        </div>
      ) : (
        <>
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
                    <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--ink)", flex: 1 }}>{ROLE_LABEL[c.role]}</span>
                    <span className="k-tnum" style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                      {roleWho(c.role)}
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
                      setRoleFilter(v as ApiStaffRole | "All roles");
                      setPage(1);
                    }}
                    options={[{ value: "All roles", label: "All roles" }, ...ROLE_OPTIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
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
        </>
      )}

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
              disabled={!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim()) || submitting}
              onClick={sendInvitation}
            >
              {submitting ? "Sending…" : "Send invitation"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, font: "var(--text-body)", color: "var(--ink-2)" }}>
            They receive an email with a 6-digit invite code and set their own password and authenticator. The account exists only once they accept.
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
                label={ROLE_LABEL[r]}
                description={INVITE_ROLE_INFO[r]}
              />
            ))}
          </div>
          {actionError && <div className="error-strip">{actionError}</div>}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="clock" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Invitation is logged against {currentName}
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
            {invited?.email} can redeem the 6-digit invite code and set up their authenticator. They appear as Invited until then.
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
              {invited?.name} · {invited ? ROLE_LABEL[invited.role] : ""}
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
            <Button size="md" disabled={submitting} onClick={confirmEdit}>
              {submitting ? "Saving…" : "Save role"}
            </Button>
          </>
        }
      >
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusPill status={editing.status} label={STATUS_LABEL[editing.status]} size="sm" />
            </div>
            <div className="k-tnum" style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {editing.email} · added {fmtDate(editing.addedAt, "—")} · last sign-in {fmtDate(editing.lastSignIn, "never")}
            </div>
            <Select
              label="Role"
              value={editRole}
              onChange={(v) => setEditRole(v as ApiStaffRole)}
              options={ROLE_ASSIGN_OPTIONS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
            {impact && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: "var(--indicator-tint)", borderRadius: "var(--r-card)" }}>
                <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--indicator)" }}>
                  {impact.label}
                </span>
                <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{impact.summary}</span>
              </div>
            )}
            {actionError && <div className="error-strip">{actionError}</div>}
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
              disabled={!deactivateReason || submitting}
              style={{ background: deactivateReason ? "var(--loss)" : "var(--ink-3)" }}
              onClick={confirmDeactivate}
            >
              {submitting ? "Deactivating…" : "Deactivate account"}
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
          {actionError && <div className="error-strip">{actionError}</div>}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Recorded in the audit log against {currentName}
            </span>
          </div>
        </div>
      </Modal>
    </div>
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
