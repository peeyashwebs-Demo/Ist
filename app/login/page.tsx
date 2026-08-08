"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/icons/Icon";
import { staffLogin, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";

type View = "sign-in" | "reset-request" | "reset-unavailable";

const DEMO_EMAIL = "admin@kudimata.internal";

function FeaturePanel({ showStats }: { showStats: boolean }) {
  return (
    <div
      style={{
        background: "var(--feature)",
        color: "var(--feature-ink)",
        padding: "40px 48px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Image src="/brand/kudimata-mark-white.svg" alt="" width={26} height={30} priority />
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.17px", color: "var(--feature-ink)" }}>
          Kudimata <span style={{ fontWeight: 400, color: "var(--feature-ink-2)" }}>Securities</span>
        </span>
      </div>

      <div>
        <span
          style={{
            font: "var(--text-label)",
            letterSpacing: "var(--track-label)",
            textTransform: "uppercase",
            color: "var(--feature-ink-2)",
          }}
        >
          Operations desk
        </span>
        <div style={{ font: "var(--text-hero)", letterSpacing: "var(--track-hero)", marginTop: 14, maxWidth: 460 }}>
          Every account on Kudimata is cleared by someone at this desk.
        </div>
        {showStats ? (
          <div style={{ display: "flex", gap: 40, marginTop: 34 }}>
            <div>
              <div className="k-tnum" style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)" }}>34</div>
              <div style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--feature-ink-2)", marginTop: 4 }}>
                Awaiting review
              </div>
            </div>
            <div>
              <div className="k-tnum" style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)" }}>6m 12s</div>
              <div style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--feature-ink-2)", marginTop: 4 }}>
                Median decision
              </div>
            </div>
            <div>
              <div className="k-tnum" style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)" }}>12,480</div>
              <div style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--feature-ink-2)", marginTop: 4 }}>
                Registered clients
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--feature-ink-2)" }}>
        Kudimata Securities Ltd · SEC-registered · Internal use only
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();

  const [view, setView] = useState<View>("sign-in");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetEmail, setResetEmail] = useState(DEMO_EMAIL);

  // SEAM: POST /staff/auth/login — email + password only, no TOTP step.
  // (2026-08-08 product decision: TOTP removed from the sign-in flow, both
  // here and on the backend — see Kudimata-Securities-Backend's
  // docs/admin-api-reference.html, staff-auth category note.)
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await staffLogin(email, password);
      auth.login(session);
      router.push("/overview");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That email and password don't match.");
    } finally {
      setSubmitting(false);
    }
  };

  const backToSignIn = () => {
    setView("sign-in");
    setError(null);
    setPassword("");
  };

  const handleRequestReset = (e: FormEvent) => {
    e.preventDefault();
    // SEAM: NO MATCHING BACKEND ROUTE. There is no self-service staff
    // password-reset endpoint anywhere in staff-auth — a real product gap,
    // not a wiring gap. Show the honest "not available" state below rather
    // than faking a "check your inbox" success.
    setView("reset-unavailable");
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 480px",
        background: "var(--bg)",
      }}
    >
      <FeaturePanel showStats={view === "sign-in" && !error} />

      <div style={{ background: "var(--paper)", padding: "40px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {view === "sign-in" ? (
          <>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Staff sign in
            </span>
            <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: "8px 0 6px" }}>
              Sign in to the desk
            </h1>
            <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: error ? "0 0 20px" : "0 0 26px" }}>
              Use your Kudimata staff address. Sessions end after 30 minutes idle.
            </p>

            {error ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  background: "var(--status-rejected-tint)",
                  borderRadius: "var(--r-input)",
                  marginBottom: 20,
                }}
              >
                <Icon name="alert" size={17} color="var(--loss)" />
                <span style={{ font: "var(--text-body)", lineHeight: "19px", color: "var(--loss)" }}>{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input
                label="Work email"
                type="email"
                prefix={<Icon name="mail" size={16} color="var(--ink-3)" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                height={50}
                required
              />
              <Input
                label="Password"
                type="password"
                prefix={<Icon name="lock" size={16} color="var(--ink-3)" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error ? "Check the password and try again." : undefined}
                height={50}
                required
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <Checkbox checked={trustDevice} onChange={setTrustDevice} label="Trust this device for 7 days" />
                <button
                  type="button"
                  onClick={() => setView("reset-request")}
                  style={{ font: "var(--text-body)", color: "var(--ink-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Forgot password
                </button>
              </div>
              <Button type="submit" size="lg" fullWidth iconRight="arrowUpRight" loading={submitting}>
                Sign in
              </Button>
              {!error ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <Icon name="shield" size={15} color="var(--ink-3)" />
                  <span style={{ font: "var(--text-micro)", letterSpacing: "var(--track-micro)", textTransform: "uppercase", color: "var(--ink-3)" }}>
                    All actions on this desk are logged against your name
                  </span>
                </div>
              ) : null}
            </form>
          </>
        ) : null}

        {view === "reset-request" ? (
          <>
            <span style={{ font: "var(--text-label)", letterSpacing: "var(--track-label)", textTransform: "uppercase", color: "var(--ink-3)" }}>
              Password
            </span>
            <h1 style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)", margin: "8px 0 6px" }}>
              Request a reset link
            </h1>
            <p style={{ font: "var(--text-body)", color: "var(--ink-2)", margin: "0 0 26px" }}>
              We&apos;ll email a link to your staff address. It expires 30 minutes after we send it.
            </p>
            <form onSubmit={handleRequestReset} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input
                label="Work email"
                type="email"
                prefix={<Icon name="mail" size={16} color="var(--ink-3)" />}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                hint="Personal addresses are not accepted."
                height={50}
                required
              />
              <Button type="submit" size="lg" fullWidth>
                Send reset link
              </Button>
              <Button type="button" variant="ghost" size="md" fullWidth iconLeft="back" onClick={backToSignIn}>
                Back to sign in
              </Button>
            </form>
          </>
        ) : null}

        {view === "reset-unavailable" ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 0", textAlign: "center" }}>
              <span
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "var(--track)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="alert" size={28} color="var(--ink-3)" />
              </span>
              <div style={{ font: "var(--text-title)", letterSpacing: "var(--track-title)", color: "var(--ink)" }}>
                Self-service reset isn&apos;t available yet
              </div>
              <p style={{ font: "var(--text-body)", color: "var(--ink-2)", maxWidth: 340 }}>
                There&apos;s no password-reset link to send — that endpoint doesn&apos;t exist on the backend yet.
                Ask a super admin to deactivate and re-invite your account instead.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <Button variant="ghost" fullWidth iconLeft="back" onClick={backToSignIn}>
                Back to sign in
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
