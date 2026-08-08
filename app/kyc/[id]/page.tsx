"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { KycRejectReason, KycSubmission } from "@/types/api";
import { decideKycSubmission, getKycSubmissionById, saveKycReviewerChecklist } from "@/lib/mock/kyc";
import { recordKycOverride } from "@/lib/mock/audit";
import { useMockLoading } from "@/lib/useMockLoading";
import { PageHead } from "@/components/ui/PageHead";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Radio } from "@/components/ui/Radio";
import { Checkbox } from "@/components/ui/Checkbox";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { Icon } from "@/components/icons/Icon";
import { SkeletonCard, SkeletonInline } from "@/components/ui/Skeleton";

// Mock "today" — matches the desk-wide anchor date used across the queue,
// transactions and audit log screens.
const CASE_LOG_DATE = "14 Mar 2026";
const STAFF_NAME = "Fola Adeyemi";

// Reason shown to the client maps 1:1 to the real decision endpoint's
// rejectReason enum — the label is display-only, `value` is what actually
// goes over the wire (see KycRejectReason in types/api.ts).
const REJECT_REASONS: Array<{ label: string; description?: string; value: KycRejectReason }> = [
  { label: "Liveness capture inconclusive", description: "Ask for a re-capture in daylight", value: "liveness_inconclusive" },
  { label: "Document unreadable", value: "unreadable" },
  { label: "Name does not match BVN", value: "name_mismatch" },
  { label: "Document expired", value: "expired" },
];

// Seeded when a case has never had a reviewer checklist saved against it
// (reviewerChecks starts null in the mock) — the five checks a KYC reviewer
// works through before deciding a case.
const DEFAULT_CHECKLIST: Array<{ label: string; checked: boolean }> = [
  { label: "Document matches BVN name", checked: false },
  { label: "Face matches liveness capture", checked: false },
  { label: "Document within expiry", checked: false },
  { label: "Address supported by utility bill", checked: false },
  { label: "No sanctions / PEP hit", checked: false },
];

/** Derives the vendor's per-check result grid from the submission's raw
 * checks/flag/documents — the vendor-only fields the design's sidebar shows
 * (BVN lookup / Name / Doc authenticity / Liveness / Sanctions / Duplicate). */
function vendorResultRows(submission: KycSubmission) {
  const bvnCheck = submission.checks.find((c) => c.label === "Name matches BVN")?.value ?? "Match";
  const livenessCheck = submission.checks.find((c) => c.label === "Liveness check")?.value ?? "Passed";
  const sanctionsCheck = submission.checks.find((c) => c.label.startsWith("Sanctions"))?.value ?? "No hits";
  const docFlagged = submission.documents.some((d) => d.status === "rejected" || d.status === "expired");

  return [
    { label: "BVN lookup", value: bvnCheck === "Duplicate" ? "Duplicate on file" : bvnCheck },
    { label: "Name", value: bvnCheck === "Mismatch" ? "Does not match BVN" : "Matches BVN record" },
    { label: "Doc authenticity", value: docFlagged ? "Flagged for review" : "Passed" },
    { label: "Liveness", value: livenessCheck },
    { label: "Sanctions", value: sanctionsCheck },
    { label: "Duplicate", value: submission.flagReason === "Duplicate BVN" ? "Possible duplicate" : "None found" },
  ];
}

/** Constructs a case-history timeline out of the submission's own fields —
 * no extra data needed, just the story the record already tells. */
function caseTimeline(submission: KycSubmission) {
  const items = [
    { when: submission.submittedAt, what: `Submission received · ${submission.documentType} uploaded` },
    { when: submission.submittedAt, what: `Flagged for ${submission.flagReason.toLowerCase()} · ${submission.flagDetail}` },
    submission.vendorDecision === "No decision"
      ? { when: submission.submittedAt, what: `Vendor returned no decision · confidence ${submission.confidence}` }
      : { when: submission.submittedAt, what: `Vendor auto-decision: ${submission.vendorDecision} · confidence ${submission.confidence}` },
  ];
  if (submission.status === "review" || submission.status === "pending") {
    items.push({ when: "Now", what: `Waiting on the desk · ${submission.waitingFor} elapsed` });
  }
  return items;
}

export default function KycCasePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const loading = useMockLoading();

  const [submission, setSubmission] = useState<KycSubmission | undefined>(() => getKycSubmissionById(id));
  const [modal, setModal] = useState<null | "approve" | "reject">(null);
  const [reTakeLiveness, setReTakeLiveness] = useState(false);
  const [rejectReasonIndex, setRejectReasonIndex] = useState(0);

  // Reviewer checklist — draft state for the checklist card. Seeded from the
  // submission's saved reviewerChecks/internalNote, or the default five-item
  // checklist when nobody has saved one yet (reviewerChecks is null).
  const [checklist, setChecklist] = useState<Array<{ label: string; checked: boolean }>>(
    () => submission?.reviewerChecks ?? DEFAULT_CHECKLIST.map((c) => ({ ...c })),
  );
  const [noteDraft, setNoteDraft] = useState(() => submission?.internalNote ?? "");
  const [checklistJustSaved, setChecklistJustSaved] = useState(false);

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
  // decideKycSubmission only ever lands a case on the terminal "rejected"
  // status once attemptCount has hit maxAttempts — see lib/mock/kyc.ts.
  const isResubmissionLimitReached = submission.status === "rejected";
  const canDecide = hasSavedNote && !isDecided;

  function pushQueueToast(payload: { title: string; message: string }) {
    try {
      sessionStorage.setItem("kyc-toast", JSON.stringify(payload));
    } catch {
      // ignore — sessionStorage unavailable
    }
  }

  const saveChecklist = () => {
    const saved = saveKycReviewerChecklist(submission.id, checklist, noteDraft.trim() || null);
    if (!saved) return;
    setSubmission({ ...saved });
    setChecklistJustSaved(true);
    window.setTimeout(() => setChecklistJustSaved(false), 2400);
  };

  const confirmApprove = () => {
    if (!canDecide) return;
    const decided = decideKycSubmission(submission.id, "approved");
    if (!decided) return;
    recordKycOverride({
      submissionId: decided.id,
      clientName: decided.name,
      decision: "approved",
      reason: (decided.internalNote ?? "").trim(),
      staffName: STAFF_NAME,
    });
    pushQueueToast({
      title: "Case approved",
      message: `${decided.name} is now verified at ${decided.tier}. Override logged against ${STAFF_NAME}.`,
    });
    setModal(null);
    router.push("/kyc");
  };

  const confirmReject = () => {
    if (!canDecide) return;
    const reason = REJECT_REASONS[rejectReasonIndex];
    const decided = decideKycSubmission(submission.id, "rejected", reason.value);
    if (!decided) return;
    recordKycOverride({
      submissionId: decided.id,
      clientName: decided.name,
      decision: "rejected",
      reason: `${reason.label} — ${(decided.internalNote ?? "").trim()}`,
      staffName: STAFF_NAME,
    });
    pushQueueToast({
      title: "Case rejected",
      message:
        decided.status === "rejected"
          ? `${decided.name} has used all ${decided.maxAttempts} attempts. The case is now closed. Override logged against ${STAFF_NAME}.`
          : `${decided.name} was rejected and asked to re-submit (attempt ${decided.attemptCount} of ${decided.maxAttempts}). Override logged against ${STAFF_NAME}.`,
    });
    setModal(null);
    router.push("/kyc");
  };

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
        description={`Case ${submission.id} · ${submission.documentType} · ${submission.tier} · submitted ${submission.submittedAt} · ${submission.city} · waiting ${submission.waitingFor}`}
        onBack={() => router.push("/kyc")}
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft="mail" disabled title="Request-info flow isn't built yet — coming soon">
              Request info
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setModal("reject")}
              disabled={!canDecide}
              title={isDecided ? "This case has already been decided" : !hasSavedNote ? "Save a reviewer checklist note before deciding" : undefined}
            >
              Reject
            </Button>
            <Button
              size="sm"
              iconLeft="check"
              onClick={() => setModal("approve")}
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
            {submission.vendorDecision === "No decision"
              ? `No auto-decision · ${submission.flagReason.toLowerCase()} · confidence ${submission.confidence}`
              : `Vendor ${submission.vendorDecision.toLowerCase()} · ${submission.flagReason.toLowerCase()} · confidence ${submission.confidence}`}
          </span>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {`Vendor run ${submission.submittedAt} · ${submission.vendorDetail}. A desk decision here is an override and is logged against your name.`}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
        <Card eyebrow="Submitted documents" title={submission.documents[0]?.name ?? "Documents"}>
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
              <span style={{ font: "var(--text-data)", color: "var(--ink-2)" }}>{submission.documents[0]?.name ?? "No document on file"}</span>
              <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                {submission.documents[0]?.meta ?? ""}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {submission.documents.map((doc) => (
                <DocumentPreview key={doc.name} document={doc} />
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
              {submission.vendorDetail}. Document photo and capture were reviewed by the vendor before this case reached the desk.
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button variant="secondary" size="sm" onClick={saveChecklist} disabled={isDecided}>
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
          <Button variant="secondary" size="md" onClick={() => setModal("reject")} disabled={!canDecide}>
            Reject
          </Button>
          <Button size="md" iconLeft="check" onClick={() => setModal("approve")} disabled={!canDecide}>
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
            <Button variant="ghost" size="md" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button size="md" iconLeft="check" disabled={!canDecide} onClick={confirmApprove}>
              Approve and notify
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ font: "var(--text-body)", color: "var(--ink-2)" }}>
            {`This approves the account for trading at ${submission.tier} and notifies the client. ${
              submission.vendorDecision === "No decision"
                ? `You are overriding the vendor, which returned no decision at ${submission.confidence} confidence.`
                : `You are overriding the vendor's ${submission.vendorDecision.toLowerCase()} result (confidence ${submission.confidence}).`
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
              {`Logged as an override · case ${submission.id} · ${CASE_LOG_DATE}`}
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
            <Button variant="ghost" size="md" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button size="md" disabled={!canDecide} onClick={confirmReject}>
              Reject and notify
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
