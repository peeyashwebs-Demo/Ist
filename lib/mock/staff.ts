import type { StaffMember, StaffRole } from "@/types/api";

// Seven accounts on the desk, distributed 1 Super admin / 1 Compliance officer /
// 2 KYC reviewers / 3 Support — exact counts and sample identities from the
// approved design (frame 8a's staffRows / roleCards data model).
export const STAFF_MEMBERS: StaffMember[] = [
  {
    id: "STF-100",
    name: "Ifedayo Martins",
    email: "ifedayo.martins@kudimata.ng",
    role: "Super admin",
    status: "approved",
    statusLabel: "Active",
    lastSignIn: "14 Mar 2026 · 09:44",
    addedAt: "2 Jan 2024",
  },
  {
    id: "STF-101",
    name: "Fola Adeyemi",
    email: "fola.adeyemi@kudimata.ng",
    role: "Compliance officer",
    status: "approved",
    statusLabel: "Active",
    lastSignIn: "14 Mar 2026 · 08:41",
    addedAt: "18 Feb 2024",
  },
  {
    id: "STF-102",
    name: "Grace Aigbe",
    email: "grace.aigbe@kudimata.ng",
    role: "KYC reviewer",
    status: "approved",
    statusLabel: "Active",
    lastSignIn: "14 Mar 2026 · 08:59",
    addedAt: "4 Sep 2024",
  },
  {
    id: "STF-103",
    name: "Chidi Nwankwo",
    email: "chidi.nwankwo@kudimata.ng",
    role: "KYC reviewer",
    status: "approved",
    statusLabel: "Active",
    lastSignIn: "13 Mar 2026 · 18:02",
    addedAt: "11 Nov 2024",
  },
  {
    id: "STF-104",
    name: "Aisha Lawal",
    email: "aisha.lawal@kudimata.ng",
    role: "Support",
    status: "approved",
    statusLabel: "Active",
    lastSignIn: "14 Mar 2026 · 07:55",
    addedAt: "20 Jan 2025",
  },
  {
    id: "STF-105",
    name: "Musa Ibrahim",
    email: "musa.ibrahim@kudimata.ng",
    role: "Support",
    status: "pending",
    statusLabel: "Invited",
    lastSignIn: "Never",
    addedAt: "13 Mar 2026",
  },
  {
    id: "STF-106",
    name: "Peter Oyelaran",
    email: "peter.oyelaran@kudimata.ng",
    role: "Support",
    status: "expired",
    statusLabel: "Deactivated",
    lastSignIn: "9 Mar 2026 · 16:20",
    addedAt: "3 Mar 2025",
  },
];

// SEAM: replace with the authenticated staff session (whoami / auth context)
export const CURRENT_STAFF = STAFF_MEMBERS[0];

export const ROLE_CARDS: Array<{ role: StaffRole; who: string; can: string; cannot: string }> = [
  {
    role: "Super admin",
    who: "1 person",
    can: "Everything, including staff and roles",
    cannot: "Nothing is withheld",
  },
  {
    role: "Compliance officer",
    who: "1 person",
    can: "Suspend and enable clients · release payouts",
    cannot: "Cannot manage staff",
  },
  {
    role: "KYC reviewer",
    who: "2 people",
    can: "Override KYC decisions · read the audit log",
    cannot: "Cannot suspend clients or manage staff",
  },
  {
    role: "Support",
    who: "3 people",
    can: "Read clients, transactions and cases",
    cannot: "Cannot decide, suspend or release anything",
  },
];

// SEAM: replace with GET /staff-members (roles: compliance_officer,
// super_admin — supports page/pageSize/role/status query params)
export function getStaffMembers() {
  return STAFF_MEMBERS;
}

// SEAM: no single-staff-fetch endpoint exists on the real API — there is no
// GET /staff-members/:id route documented. List-and-filter client-side from
// GET /staff-members (paginated, so a large roster may need more than one
// page fetched), or flag this as a product gap for the backend to close.
export function getStaffMemberById(id: string) {
  return STAFF_MEMBERS.find((s) => s.id === id);
}
