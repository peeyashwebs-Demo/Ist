import type {
  AccountStatus,
  KycCheck,
  KycDocument,
  KycStatus,
  User,
  UserHolding,
  UserKycFile,
  UserTransactionEntry,
} from "@/types/api";

const FIRST_NAMES = [
  "Fola", "Ada", "Chidi", "Amaka", "Tunde", "Ngozi", "Bola", "Emeka", "Yemi", "Chioma",
  "Segun", "Ifeoma", "Kunle", "Blessing", "Wale", "Uche", "Femi", "Nkechi", "Dele", "Aisha",
  "Musa", "Grace", "Ibrahim", "Funke", "Chinedu", "Halima", "Obinna", "Zainab", "Tayo", "Ronke",
  "Kelechi", "Maryam",
];
const LAST_NAMES = [
  "Adeyemi", "Okafor", "Balogun", "Eze", "Okonkwo", "Bello", "Nwosu", "Abubakar", "Ojo", "Chukwu",
  "Afolabi", "Umeh", "Yusuf", "Adebayo", "Nnamdi", "Suleiman", "Onyekwere", "Lawal", "Ibrahim", "Nwachukwu",
  "Fashola", "Danjuma", "Okorie", "Sanni", "Ekwueme",
];
const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Kaduna", "Jos", "Uyo", "Owerri", "Warri"];

const KYC_CYCLE: KycStatus[] = ["approved", "approved", "approved", "approved", "review", "pending", "approved", "rejected", "approved", "expired", "approved", "review"];

const INSTRUMENTS = [
  { symbol: "DANGCEM", name: "Dangote Cement Plc" },
  { symbol: "MTNN", name: "MTN Nigeria Communications" },
  { symbol: "GTCO", name: "Guaranty Trust Holding Co." },
  { symbol: "ZENITHBANK", name: "Zenith Bank Plc" },
  { symbol: "BUACEMENT", name: "BUA Cement Plc" },
  { symbol: "AIRTELAFRI", name: "Airtel Africa Plc" },
  { symbol: "NESTLE", name: "Nestlé Nigeria Plc" },
  { symbol: "SEPLAT", name: "Seplat Energy Plc" },
  { symbol: "FBNH", name: "FBN Holdings Plc" },
  { symbol: "STANBIC", name: "Stanbic IBTC Holdings" },
];

function pad(n: number, len = 5) {
  return String(n).padStart(len, "0");
}

export function money(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateAt(dayOffset: number) {
  // Deterministic display dates anchored to the desk's "today" (14 Mar 2026).
  const base = new Date(Date.UTC(2026, 2, 14));
  base.setUTCDate(base.getUTCDate() - dayOffset);
  return base.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function makeHoldings(seed: number): UserHolding[] {
  const count = 2 + (seed % 3);
  return Array.from({ length: count }).map((_, i) => {
    const inst = INSTRUMENTS[(seed + i * 3) % INSTRUMENTS.length];
    const units = 100 + ((seed + i * 40) % 900);
    const avg = 18 + ((seed * 3 + i * 7) % 60);
    const last = avg + (((seed + i) % 2 === 0 ? 1 : -1) * ((seed + i * 5) % 12));
    const value = units * last;
    const changePct = (((last - avg) / avg) * 100).toFixed(2);
    return {
      id: `HLD-${pad(seed * 10 + i)}`,
      symbol: inst.symbol,
      name: inst.name,
      units: units.toLocaleString("en-NG"),
      avgCost: money(avg),
      lastPrice: money(last),
      value: money(value),
      todayChange: `${last >= avg ? "+" : ""}${changePct}%`,
      tone: last >= avg ? "gain" : "loss",
    };
  });
}

const TX_TYPES: UserTransactionEntry["type"][] = ["Deposit", "Buy", "Sell", "Withdrawal"];

function makeTransactions(seed: number): UserTransactionEntry[] {
  const count = 3 + (seed % 4);
  return Array.from({ length: count }).map((_, i) => {
    const type = TX_TYPES[(seed + i) % TX_TYPES.length];
    const amount = 15000 + ((seed * 17 + i * 900) % 500000);
    const signed = type === "Withdrawal" || type === "Buy" ? -amount : amount;
    const statusRoll = (seed + i) % 10;
    const status: UserTransactionEntry["status"] = statusRoll === 9 ? "review" : statusRoll === 8 ? "rejected" : "approved";
    const statusLabel = status === "approved" ? "Settled" : status === "review" ? "Under review" : "Returned";
    return {
      id: `TXU-${pad(seed * 10 + i)}`,
      when: dateAt(i * 3 + (seed % 5)),
      reference: `TRX-${90000 + seed * 7 + i}`,
      type,
      detail: type === "Buy" || type === "Sell" ? `${INSTRUMENTS[(seed + i) % INSTRUMENTS.length].symbol} · ${20 + i} units` : type === "Deposit" ? "Bank transfer · GTBank" : "Bank transfer · Access Bank",
      amount: `${signed >= 0 ? "+" : "-"}${money(amount)}`,
      status,
      statusLabel,
    };
  });
}

const KYC_DOCS: Array<{ name: string; meta: string }> = [
  { name: "NIN slip", meta: "Uploaded · matches BVN" },
  { name: "Proof of address", meta: "Utility bill · < 3 months" },
  { name: "Selfie liveness", meta: "Auto-matched · 98.2%" },
];

function makeKycFile(seed: number, status: KycStatus): UserKycFile {
  const docs: KycDocument[] = KYC_DOCS.map((d, i) => {
    const docStatus: KycStatus = status === "rejected" && i === 0 ? "rejected" : status === "expired" ? "expired" : "approved";
    return {
      name: d.name,
      meta: d.meta,
      status: docStatus,
      statusLabel: docStatus === "approved" ? "Verified" : docStatus === "rejected" ? "Mismatch" : "Expired",
    };
  });
  const checks: KycCheck[] = [
    { label: "Name matches BVN record", value: status === "rejected" ? "No match" : "Exact" },
    { label: "Face match score", value: `0.${94 + (seed % 5)}` },
    { label: "Address in country", value: "Yes" },
    { label: "Sanctions and PEP screen", value: status === "review" ? "Flagged" : "Clear" },
  ];
  return {
    bvn: `221${pad(seed * 3, 7)}`,
    nin: `${pad(seed * 11, 11)}`,
    tier: `Tier ${1 + (seed % 3)}`,
    submittedAt: dateAt(30 + seed),
    address: `${12 + (seed % 80)} ${["Adeola Odeku", "Awolowo", "Ademola Adetokunbo", "Ozumba Mbadiwe"][seed % 4]} Street, ${CITIES[seed % CITIES.length]}`,
    nextOfKin: `${FIRST_NAMES[(seed + 5) % FIRST_NAMES.length]} ${LAST_NAMES[(seed + 5) % LAST_NAMES.length]}`,
    documents: docs,
    checks,
  };
}

const USER_COUNT = 34;

export const USERS: User[] = Array.from({ length: USER_COUNT }).map((_, i) => {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
  const kycStatus = KYC_CYCLE[i % KYC_CYCLE.length];
  const accountStatus: AccountStatus = i % 11 === 0 ? "suspended" : "active";
  const portfolio = 180000 + ((i * 91327) % 4200000);

  return {
    id: `U-${10000 + i * 37}`,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@${["gmail.com", "yahoo.com", "outlook.com"][i % 3]}`,
    phone: `+234 ${800 + (i % 20)} ${100 + (i * 13) % 900} ${1000 + (i * 37) % 9000}`,
    city: CITIES[i % CITIES.length],
    kycStatus,
    joinedAt: dateAt(20 + i * 11),
    accountStatus,
    portfolioValue: money(portfolio),
    holdings: makeHoldings(i + 1),
    transactions: makeTransactions(i + 1),
    kyc: makeKycFile(i + 1, kycStatus),
  };
});

// SEAM: replace with GET /api/admin/users
export function getUsers() {
  return USERS;
}

// SEAM: replace with GET /api/admin/users/:id
export function getUserById(id: string) {
  return USERS.find((u) => u.id === id);
}

export interface KycAutoDecision {
  status: KycStatus;
  label: string;
  confidence: string;
  summary: string;
  clearedAt?: string;
  confirmedBy?: string;
}

const AUTO_DECISION_COPY: Record<KycStatus, { label: string; summary: string }> = {
  approved: { label: "Auto-approved", summary: "All automated checks cleared with no flags; no manual review was required." },
  review: { label: "Needs review", summary: "Automated checks could not reach a confident decision, so this case is queued for a KYC reviewer." },
  pending: { label: "Pending checks", summary: "Documents have been received but automated verification hasn't completed yet." },
  rejected: { label: "Auto-rejected", summary: "Automated checks found a document or identity mismatch and declined the submission." },
  expired: { label: "Expired", summary: "This client's verification documents have expired and need to be resubmitted." },
};

// SEAM: replace with GET /api/admin/users/:id/kyc-decision
export function getKycAutoDecision(user: User): KycAutoDecision {
  const seed = Number(user.id.replace(/\D/g, "")) || 1;
  const copy = AUTO_DECISION_COPY[user.kycStatus];
  const decision: KycAutoDecision = {
    status: user.kycStatus,
    label: copy.label,
    confidence: `${88 + (seed % 11)}.${seed % 10}%`,
    summary: copy.summary,
  };
  if (user.kycStatus === "approved") {
    const hh = String(8 + (seed % 9)).padStart(2, "0");
    const mm = String((seed * 7) % 60).padStart(2, "0");
    decision.clearedAt = `${dateAt(30 + seed)} at ${hh}:${mm}`;
    decision.confirmedBy = `${FIRST_NAMES[(seed + 2) % FIRST_NAMES.length]} ${LAST_NAMES[(seed + 2) % LAST_NAMES.length]}`;
  }
  return decision;
}

export interface UserSummaryTrend {
  label: string;
  tone: "gain" | "loss";
}

export interface UserSummary {
  cashBalance: string;
  lifetimeDeposits: string;
  ordersLast30: number;
  portfolioTrend: UserSummaryTrend;
  ordersTrend?: UserSummaryTrend;
}

function parseCurrency(v: string) {
  return Number(v.replace(/[^\d.-]/g, "")) || 0;
}

// SEAM: replace with GET /api/admin/users/:id/summary
export function getUserSummary(user: User): UserSummary {
  const seed = Number(user.id.replace(/\D/g, "")) || 1;
  const portfolio = parseCurrency(user.portfolioValue);
  const cash = Math.round(portfolio * (0.06 + (seed % 9) / 100));

  const depositedOnRecord = user.transactions
    .filter((t) => t.type === "Deposit")
    .reduce((sum, t) => sum + parseCurrency(t.amount), 0);
  const lifetimeDeposits = Math.round(depositedOnRecord + portfolio * (0.4 + (seed % 5) / 20));

  const ordersLast30 = user.transactions.filter((t) => t.type === "Buy" || t.type === "Sell").length;

  const portfolioTrendPct = Number((((seed % 13) - 6) / 2).toFixed(1));
  const ordersDelta = (seed % 7) - 3;

  return {
    cashBalance: money(cash),
    lifetimeDeposits: money(lifetimeDeposits),
    ordersLast30,
    portfolioTrend: {
      label: `${portfolioTrendPct >= 0 ? "+" : ""}${portfolioTrendPct}% this month`,
      tone: portfolioTrendPct >= 0 ? "gain" : "loss",
    },
    ordersTrend:
      ordersDelta === 0
        ? undefined
        : {
            label: `${ordersDelta > 0 ? "+" : ""}${ordersDelta} vs last month`,
            tone: ordersDelta >= 0 ? "gain" : "loss",
          },
  };
}
