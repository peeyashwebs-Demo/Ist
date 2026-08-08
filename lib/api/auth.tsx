"use client";

// Minimal React session layer over TokenStore (lib/api/client.ts). Every
// screen-wiring dev wraps the app in <AuthProvider> and reads useAuth() to
// guard pages and know the current staff role for role-gated UI.
//
// Deliberately thin: this module owns session persistence only, not the
// two-step login flow itself (email+password -> pre-auth token -> TOTP ->
// session) — that belongs to whichever screen implements the login page
// (see staffLogin/staffVerifyTotp/staffAcceptInvite in lib/api/client.ts).
// That screen calls this context's login() once it has a real
// ApiStaffSession in hand.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { TokenStore, toStoredSession, type StoredSession } from "./client";
import type { ApiStaffSession, ApiStaffRole } from "./types";

/** The current staff identity + role, or null when signed out. Mirrors
 * StoredSession (lib/api/client.ts) — kept as a distinct exported type so
 * consuming screens depend on this module's contract, not the storage
 * layer's internal shape. */
export interface StaffSession {
  staffId: string;
  role: ApiStaffRole | null;
  accessToken: string;
  expiresAt: string;
}

interface AuthContextValue {
  /** Current staff session, or null if not signed in. */
  session: StaffSession | null;
  isAuthenticated: boolean;
  /** Persists a session obtained from the real two-step login flow
   * (staffVerifyTotp's response) and makes it the current session. Decodes
   * `role` from the access token — see decodeAccessTokenRole in
   * lib/api/client.ts. */
  login: (session: ApiStaffSession) => void;
  /** Clears the stored session. Does not call any endpoint — the docs
   * describe no server-side sign-out/session-revocation route; a session
   * simply expires at its own `expiresAt` (30-minute idle window) if never
   * cleared here. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toStaffSession(stored: StoredSession | null): StaffSession | null {
  if (!stored) return null;
  return {
    staffId: stored.staffId,
    role: stored.role,
    accessToken: stored.accessToken,
    expiresAt: stored.expiresAt,
  };
}

function getServerSnapshot(): StoredSession | null {
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Reads TokenStore as an external store (localStorage, mediated through
  // TokenStore's in-memory cache) rather than useState+useEffect — avoids a
  // synchronous setState-in-effect render cascade and re-renders correctly
  // whenever login()/logout() call TokenStore.set()/clear() and notify
  // subscribers. Server snapshot is always null: a real session can only
  // ever have been established client-side.
  const stored = useSyncExternalStore(TokenStore.subscribe, TokenStore.get, getServerSnapshot);
  const session = useMemo(() => toStaffSession(stored), [stored]);

  const login = useCallback((authSession: ApiStaffSession) => {
    TokenStore.set(toStoredSession(authSession));
  }, []);

  const logout = useCallback(() => {
    TokenStore.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Throws if called outside <AuthProvider> — every screen-wiring dev must
 * mount the provider once near the app root. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
