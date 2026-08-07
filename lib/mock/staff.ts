import type { StaffMember, StaffRole, StaffStatus } from "@/types/api";

const NAMES: Array<{ name: string; email: string }> = [
  { name: "Fola Adeyemi", email: "fola.adeyemi@kudimata.ng" },
  { name: "Tomi Balogun", email: "tomi.balogun@kudimata.ng" },
  { name: "Chidi Nwankwo", email: "chidi.nwankwo@kudimata.ng" },
  { name: "Amaka Eze", email: "amaka.eze@kudimata.ng" },
  { name: "Segun Okoye", email: "segun.okoye@kudimata.ng" },
  { name: "Halima Sule", email: "halima.sule@kudimata.ng" },
  { name: "Bayo Adekunle", email: "bayo.adekunle@kudimata.ng" },
  { name: "Ifeoma Uche", email: "ifeoma.uche@kudimata.ng" },
  { name: "Kunle Bakare", email: "kunle.bakare@kudimata.ng" },
  { name: "Grace Effiong", email: "grace.effiong@kudimata.ng" },
  { name: "Obinna Chukwu", email: "obinna.chukwu@kudimata.ng" },
  { name: "Zainab Aliyu", email: "zainab.aliyu@kudimata.ng" },
  { name: "Dele Fashola", email: "dele.fashola@kudimata.ng" },
  { name: "Ronke Ajayi", email: "ronke.ajayi@kudimata.ng" },
  { name: "Emeka Obi", email: "emeka.obi@kudimata.ng" },
  { name: "Aisha Bello", email: "aisha.bello@kudimata.ng" },
  { name: "Wale Ogundipe", email: "wale.ogundipe@kudimata.ng" },
  { name: "Nkechi Anya", email: "nkechi.anya@kudimata.ng" },
];

const ROLES: StaffRole[] = ["Super admin", "Compliance officer", "KYC reviewer", "KYC reviewer", "Support"];

function statusAt(i: number): { status: StaffStatus; statusLabel: string } {
  if (i % 9 === 0) return { status: "pending", statusLabel: "Invited" };
  if (i % 13 === 0) return { status: "expired", statusLabel: "Deactivated" };
  return { status: "approved", statusLabel: "Active" };
}

function dateAt(dayOffset: number) {
  const base = new Date(Date.UTC(2026, 2, 14));
  base.setUTCDate(base.getUTCDate() - dayOffset);
  return base.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgoLabel(i: number, status: StaffStatus) {
  if (status === "pending") return "—";
  if (status === "expired") return dateAt(90 + i * 4);
  const hours = (i * 7) % 48;
  return hours === 0 ? "Just now" : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export const STAFF_MEMBERS: StaffMember[] = NAMES.map((person, i) => {
  const { status, statusLabel } = statusAt(i);
  return {
    id: `STF-${100 + i}`,
    name: person.name,
    email: person.email,
    role: ROLES[i % ROLES.length],
    status,
    statusLabel,
    lastSignIn: timeAgoLabel(i, status),
    addedAt: dateAt(30 + i * 17),
  };
});

export const ROLE_CARDS: Array<{ role: StaffRole; who: string; can: string; cannot: string }> = [
  {
    role: "Super admin",
    who: "1 person",
    can: "Everything below, plus invite/deactivate staff and change roles.",
    cannot: "Nothing — full desk access.",
  },
  {
    role: "Compliance officer",
    who: "3 people",
    can: "Approve/reject KYC, suspend/enable accounts, release held transactions.",
    cannot: "Cannot invite staff or change roles.",
  },
  {
    role: "KYC reviewer",
    who: "6 people",
    can: "Review and decide KYC cases in the queue.",
    cannot: "Cannot touch transactions, staff, or account status.",
  },
  {
    role: "Support",
    who: "8 people",
    can: "View users, transactions and audit log — read-only.",
    cannot: "Cannot approve, suspend, or release anything.",
  },
];

// SEAM: replace with GET /api/admin/staff
export function getStaffMembers() {
  return STAFF_MEMBERS;
}

// SEAM: replace with GET /api/admin/staff/:id
export function getStaffMemberById(id: string) {
  return STAFF_MEMBERS.find((s) => s.id === id);
}
