"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApiKycSubmission, ApiKycDocumentType } from "@/lib/api/types";
import { getKycSubmission, saveKycReviewerChecklist, decideKyc, ApiError } from "@/lib/api/client";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Radio } from "@/components/ui/Radio";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/icons/Icon";
import { SkeletonCard, SkeletonInline } from "@/components/ui/Skeleton";

// Reason shown to the client maps 1:1 to the real decision endpoint's
// rejectReason enum — the label is display-only, `value` is what actually
// goes over the wire (see DecideKycRequest in lib/api/types.ts).
const REJECT_REASONS: Array<{ label: string; description?: string; value: "unreadable" | "name_mismatch" | "expired" | "liveness_inconclusive" }> = [
  { label: "Liveness capture inconclusive", description: "Ask for a re-capture in daylight", value: "liveness_inconclusive" },
  { label: "Document unreadable", value: "unreadable" },
  { label: "Name does not match BVN", value: "name_mismatch" },
  { label: "Document expired", value: "expired" },
];

// Seeded when a case has never had a reviewer checklist saved against it
// (reviewerChecks starts null in the real API) — the five checks a KYC
// reviewer works through before deciding a case.
const DEFAULT_CHECKLIST: Array<{ label: string; checked: boolean }> = [
  { label: "Document matches BVN name", checked: false },
  { label: "Face matches liveness capture", checked: false },
  { label: "Document within expiry", checked: false },
  { label: "Address supported by utility bill", checked: false },
  { label: "No sanctions / PEP hit", checked: false },
];

const DOC_TYPE_LABEL: Record<ApiKycDocumentType, string> = {
  nin: "NIN",
  passport: "Passport",
  drivers_licence: "Driver's licence",
  resubmission: "Re-submission",
};

function vendorDecisionLabel(v: ApiKycSubmission["vendorDecision"]) {
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "no decision";
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function todayDate() {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Derives the vendor's per-check result grid from the submission's raw
 * provider checks — the vendor-only fields the design's sidebar shows. */
function vendorResultRows(submission: ApiKycSubmission) {
  const checks = submission.providerChecks ?? {};
  const fmt = (v?: string) => (v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Not checked");
  const bvn = checks.bvnLookup;
  return [
    { label: "BVN lookup", value: fmt(bvn) },
    { label: "Name", value: bvn === "match" ? "Matches BVN record" : bvn === "mismatch" ? "Does not match BVN" : fmt(bvn) },
    { label: "Sanctions / PEP", value: fmt(checks.sanctionsPep) },
    { label: "Duplicate account", value: fmt(checks.duplicateAccount) },
    { label: "Liveness match", value: submission.livenessMatchPct != null ? `${submission.livenessMatchPct}%` : "Not captured" },
  ];
}

/** Constructs a case-history timeline out of the submission's own fields. */
function caseTimeline(submission: ApiKycSubmission) {
  const items = [
    { when: fmtDate(submission.submittedAt), what: `Submission received · ${DOC_TYPE_LABEL[submission.documentType]} uploaded` },
  ];
  if (submission.flagReason) {
    items.push({
      when: fmtDate(submission.submittedAt),
      what: `Flagged for ${submission.flagReason.toLowerCase()}${submission.flagDetail ? ` · ${submission.flagDetail}` : ""}`,
    });
  }
  items.push({
    when: fmtDate(submission.submittedAt),
    what:
      submission.vendorDecision === "no_decision"
        ? "Vendor returned no decision"
        : `Vendor auto-decision: ${vendorDecisionLabel(submission.vendorDecision)}`,
  });
  if (submission.status === "review" || submission.status === "pending") {
    items.push({ when: "Now", what: "Waiting on the desk" });
  }
  return items;
}

export default function KycCasePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ApiKycSubmission | null>(null);

  const [modal, setModal] = useState<null | "approve" | "reject">(null);
  const [reTakeLiveness, setReTakeLiveness] = useState(false);
  const [rejectReasonIndex, setRejectReasonIndex] = useState(0);

  // Reviewer checklist — draft state for the checklist card. Seeded from the
  // submission's saved reviewerChecks/internalNote, or the default five-item
  // checklist when nobody has saved one yet (reviewerChecks is null).
  const [checklist, setChecklist] = useState<Array<{ label: string; checked: boolean }>>(() =>
    DEFAULT_CHECKLIST.map((c) => ({ ...c })),
  );
  const [noteDraft, setNoteDraft] = useState("");
  const [checklistJustSaved, setChecklistJustSaved] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getKycSubmission(id)
      .then((s) => {
        if (!cancelled) setSubmission(s);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setSubmission(null);
        } else {
          setError(err instanceof ApiError ? err.message : "Couldn't load this case.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Seed the reviewer checklist/note from the freshly loaded submission.
  useEffect(() => {
    if (!submission) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecklist(submission.reviewerChecks ?? DEFAULT_CHECKLIST.map((c) => ({ ...c })));
    setNoteDraft(submission.internalNote ?? "");
    setRejectReasonIndex(0);
    setReTakeLiveness(false);
    setModal(null);
  }, [submission]);

  if (loading) {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SkeletonInline width={120} height={11} />
          <SkeletonInline width={280} height={28} />
          <SkeletonInline width={440} height={12} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <SkeletonCard lines={6} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <Card
        title="Couldn't load this case"
        actions={<Button variant="ghost" size="sm" onClick={() => router.push("/kyc")}>Back to queue</Button>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{error}</span>
        </div>
      </Card>
    );
  }

  if (!submission) {
    return (
      <Card
        title="Case not found"
        actions={<Button variant="ghost" size="sm" onClick={() => router.push("/kyc")}>Back to queue</Button>}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 460 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            No submission matches {id}. It may have been decided and removed from the exceptions queue, or the id is wrong.
          </span>
        </div>
      </Card>
    );
  }

  // The checklist save is where a staff reasoning note now lives — a
  // decision (approve/reject) requires one already saved against the case,
  // rather than collecting a second free-text note at decision time.
  const hasSavedNote = (submission.internalNote ?? "").trim().length > 0;
  const isDecided = submission.status === "approved" || submission.status === "rejected";
  // decideKyc only ever lands a case on the terminal "rejected" status once
  // attemptCount has hit maxAttempts — see lib/api/types.ts.
  const isResubmissionLimitReached = submission.status === "rejected";
  const canDecide = hasSavedNote && !isDecided;

  function pushQueueToast(payload: { title: string; message: string }) {
    try {
      sessionStorage.setItem("kyc-toast", JSON.stringify(payload));
    } catch {
      // ignore — sessionStorage unavailable
    }
  }

  const saveChecklist = async () => {
    if (!submission || isDecided) return;
    setSavingChecklist(true);
    setActionError(null);
    try {
      const saved = await saveKycReviewerChecklist(submission.id, checklist, noteDraft.trim() || null);
      setSubmission({ ...saved });
      setChecklistJustSaved(true);
      window.setTimeout(() => setChecklistJustSaved(false), 2400);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't save the checklist.");
    } finally {
      setSavingChecklist(false);
    }
  };

  const confirmApprove = async () => {
    if (!submission || !canDecide) return;
    setDeciding(true);
    setActionError(null);
    try {
      const decided = await decideKyc(submission.id, "approve");
      pushQueueToast({
        title: "Case approved",
        message: `${decided.name} is now verified at ${decided.tier}. Override logged against your name.`,
      });
      setModal(null);
      router.push("/kyc");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't approve this case.");
      setDeciding(false);
    }
  };

  const confirmReject = async () => {
    if (!submission || !canDecide) return;
    setDeciding(true);
    setActionError(null);
    try {
      const reason = REJECT_REASONS[rejectReasonIndex];
      const decided = await decideKyc(submission.id, "reject", reason.value);
      pushQueueToast({
        title: "Case rejected",
        message:
          decided.status === "rejected"
            ? `${decided.name} has used all ${decided.maxAttempts} attempts. The case is now closed. Override logged against your name.`
            : `${decided.name} was rejected and asked to re-submit (attempt ${decided.attemptCount} of ${decided.maxAttempts}). Override logged against your name.`,
      });
      setModal(null);
      router.push("/kyc");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't reject this case.");
      setDeciding(false);
    }
  };

  const vendorWord =
    submission.vendorDecision === "no_decision" ? "No auto-decision" : `Vendor ${vendorDecisionLabel(submission.vendorDecision)}`;
  const flagWord = submission.flagReason ? submission.flagReason.toLowerCase() : "manual review";
  const confidenceWord = submission.livenessMatchPct != null ? ` · confidence ${submission.livenessMatchPct}%` : "";

  return (
    <>
      <PageHead
        eyebrow={`KYC review · ${submission.id}`}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            {submission.name}
            <StatusPill status={submission.status === "approved" || submission.status === "rejected" ? submission.status : "review"} size="md" />
            <span
              className="k-tnum"
              style={{
                font: "var(--text-micro)",
                letterSpacing: "var(--track-micro)",
                textTransform: "uppercase",
                color: isResubmissionLimitReached ? "var(--loss)" : "var(--ink-3)",
              }}
            >
              {`Attempt ${submission.attemptCount} of ${submission.maxAttempts}`}
            </span>
          </span>
        }
        description={`Case ${submission.id} · ${DOC_TYPE_LABEL[submission.documentType]} · ${submission.tier} · submitted ${fmtDate(submission.submittedAt)} · ${submission.city}`}
        onBack={() => router.push("/kyc")}
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft="mail" disabled title="Request-info flow isn't built yet — coming soon">
              Request info
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setActionError(null);
                setModal("reject");
              }}
              disabled={!canDecide}
              title={isDecided ? "This case has already been decided" : !hasSavedNote ? "Save a reviewer checklist note before deciding" : undefined}
            >
              Reject
            </Button>
            <Button
              size="sm"
              iconLeft="check"
              onClick={() => {
                setActionError(null);
                setModal("approve");
              }}
              disabled={!canDecide}
              title={isDecided ? "This case has already been decided" : !hasSavedNote ? "Save a reviewer checklist note before deciding" : undefined}
            >
              Approve
            </Button>
          </>
        }
      />

      {isResubmissionLimitReached ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "var(--status-rejected-tint)", borderRadius: "var(--r-card)" }}>
          <Icon name="alert" size={17} color="var(--loss)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--loss)" }}>
              Resubmission limit reached · case closed
            </span>
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {`This client has used all ${submission.maxAttempts} attempts and been rejected each time. The case is terminal — no further decision can be made here.`}
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "var(--indicator-tint)", borderRadius: "var(--r-card)" }}>
        <Icon name="alert" size={17} color="var(--indicator)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ font: "var(--text-card-title)", fontWeight: 600, color: "var(--indicator)" }}>
            {`${vendorWord} · ${flagWord}${confidenceWord}`}
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {`${submission.vendorDetail ?? "Vendor run on record."} A desk decision here is an override and is logged against your name.`}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
        <Card eyebrow="Submitted documents" title={submission.documents[0]?.documentName ?? "Documents"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                height: 420,
                borderRadius: 12,
                background: "var(--track)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Icon name="doc" size={32} color="var(--ink-3)" />
              <span style={{ font: "var(--text-data)", color: "var(--ink-2)" }}>{submission.documents[0]?.documentName ?? "No document on file"}</span>
              {submission.documents[0] ? (
                <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                  {`${submission.documents[0].documentKind} · ${fmtDate(submission.documents[0].uploadedAt)}`}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {submission.documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 48,
                      flex: "0 0 auto",
                      borderRadius: 8,
                      background: "var(--bg)",
                      border: "1px solid var(--hairline)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name="doc" size={20} color="var(--ink-3)" />
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ font: "var(--text-card-title)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.documentName}
                    </span>
                    <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {`${doc.documentKind} · ${fmtDate(doc.uploadedAt)}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Vendor result</span>
            {vendorResultRows(submission).map((v) => (
              <div key={v.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
                <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>{v.label}</span>
                <span className="k-tnum" style={{ font: "var(--text-data)", color: "var(--ink)", textAlign: "right" }}>{v.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Liveness capture</span>
            <div style={{ height: 96, borderRadius: 10, background: "var(--track)", display: "grid", placeItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                <Icon name="fingerprint" size={16} color="var(--ink-3)" />
                Capture · 3 frames
              </span>
            </div>
            <div style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
              {submission.vendorDetail ?? "Vendor run on record."} The document photo and capture were reviewed by the vendor before this case reached the desk.
            </div>
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Case history</span>
            {caseTimeline(submission).map((t, i) => (
              <div key={`${t.when}-${i}`} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
                <span
                  className="k-tnum"
                  style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)", whiteSpace: "nowrap", width: 96, flex: "0 0 auto" }}
                >
                  {t.when}
                </span>
                <span style={{ font: "var(--text-data)", color: "var(--ink-2)" }}>{t.what}</span>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Reviewer checklist</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checklist.map((item, i) => (
                <Checkbox
                  key={item.label}
                  checked={item.checked}
                  onChange={(checked) => setChecklist((cur) => cur.map((c, ci) => (ci === i ? { ...c, checked } : c)))}
                  label={item.label}
                />
              ))}
            </div>
            <Input
              label="Reviewer note · required before a decision"
              placeholder="What you checked and why. Saved with the checklist, not the decision."
              hint="Visible to compliance and auditors — this becomes your saved reasoning for approve/reject"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              disabled={isDecided}
            />
            {actionError && !modal ? (
              <span style={{ font: "var(--text-micro)", color: "var(--loss)" }}>{actionError}</span>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button variant="secondary" size="sm" onClick={saveChecklist} disabled={isDecided || savingChecklist} loading={savingChecklist}>
                Save checklist
              </Button>
              {checklistJustSaved ? (
                <span style={{ font: "var(--text-micro)", color: "var(--gain)" }}>Saved</span>
              ) : hasSavedNote ? (
                <span style={{ font: "var(--text-micro)", color: "var(--ink-3)" }}>Note saved</span>
              ) : (
                <span style={{ font: "var(--text-micro)", color: "var(--ink-3)" }}>Not saved yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-card)",
          padding: 20,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 300px",
          gap: 24,
          alignItems: "end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
            {hasSavedNote ? "Your saved reviewer note" : "Reviewer note"}
          </span>
          {hasSavedNote ? (
            <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>{submission.internalNote}</span>
          ) : (
            <span style={{ font: "var(--text-body)", color: "var(--ink-3)" }}>
              Save a reviewer checklist note above before approving or rejecting this case.
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setActionError(null);
              setModal("reject");
            }}
            disabled={!canDecide}
          >
            Reject
          </Button>
          <Button
            size="md"
            iconLeft="check"
            onClick={() => {
              setActionError(null);
              setModal("approve");
            }}
            disabled={!canDecide}
          >
            Approve
          </Button>
        </div>
      </div>

      <Modal
        open={modal === "approve"}
        title={`Approve ${submission.name}?`}
        onClose={() => setModal(null)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setModal(null)} disabled={deciding}>
              Cancel
            </Button>
            <Button size="md" iconLeft="check" disabled={!canDecide || deciding} loading={deciding} onClick={confirmApprove}>
              Approve and notify
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {actionError && modal === "approve" ? (
            <span style={{ font: "var(--text-micro)", color: "var(--loss)" }}>{actionError}</span>
          ) : null}
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {`This approves the account for trading at ${submission.tier} and notifies the client. ${
              submission.vendorDecision === "no_decision"
                ? `You are overriding the vendor, which returned no decision${confidenceWord}.`
                : `You are overriding the vendor's ${vendorDecisionLabel(submission.vendorDecision)} result${confidenceWord}.`
            }`}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Your saved reviewer note</span>
            <span style={{ font: "var(--text-body)", color: "var(--ink)" }}>{submission.internalNote || "—"}</span>
          </div>
          <Checkbox checked={reTakeLiveness} onChange={setReTakeLiveness} label="Ask the client to re-take the liveness capture at next sign-in" />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <Icon name="shield" size={16} color="var(--ink-3)" />
            <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {`Logged as an override · case ${submission.id} · ${todayDate()}`}
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={modal === "reject"}
        title={`Reject ${submission.name}?`}
        onClose={() => setModal(null)}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setModal(null)} disabled={deciding}>
              Cancel
            </Button>
            <Button size="md" disabled={!canDecide || deciding} loading={deciding} onClick={confirmReject}>
              Reject and notify
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {actionError && modal === "reject" ? (
            <span style={{ font: "var(--text-micro)", color: "var(--loss)" }}>{actionError}</span>
          ) : null}
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {submission.attemptCount + 1 >= submission.maxAttempts
              ? `This is the client's final attempt (${submission.attemptCount + 1} of ${submission.maxAttempts}). Rejecting now closes the case — the client cannot re-submit again.`
              : `This rejects the submission and emails the client your reason. This will be attempt ${submission.attemptCount + 1} of ${submission.maxAttempts} — the client can re-submit. The account stays unfunded until a submission passes.`}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-2)" }}>Reason shown to the client</span>
            {REJECT_REASONS.map((r, i) => (
              <Radio key={r.label} checked={rejectReasonIndex === i} onChange={() => setRejectReasonIndex(i)} label={r.label} description={r.description} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "var(--bg)", borderRadius: "var(--r-input)" }}>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>Your saved reviewer note</span>
            <span style={{ font: "var(--text-body)", color: "var(--ink)" }}>{submission.internalNote || "—"}</span>
          </div>
        </div>
      </Modal>
    </>
  );
}
