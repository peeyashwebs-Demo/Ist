import { IconName } from "@/components/icons/Icon";
import { getKycSubmissions } from "@/lib/mock/kyc";
import { TRANSACTIONS } from "@/lib/mock/transactions";
import { getPendingOrders } from "@/lib/mock/orders";

export interface NavItem {
  id: string;
  href: string;
  icon: IconName;
  label: string;
  count?: string | number;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

// Queue depth shown in the Review section — exceptions awaiting a decision.
// SEAM: replace with queue-depth / held-count from the live admin API once
// the SEAM endpoints replace the mock reads below.
const KYC_QUEUE_DEPTH = getKycSubmissions().length;
const HELD_COUNT = TRANSACTIONS.filter((t) => t.status === "review").length;
const PENDING_ORDERS_COUNT = getPendingOrders().length;

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: "overview", href: "/overview", icon: "home", label: "Overview" },
      { id: "users", href: "/users", icon: "users", label: "Users" },
    ],
  },
  {
    label: "Review",
    items: [
      { id: "kyc", href: "/kyc", icon: "shield", label: "KYC review", count: KYC_QUEUE_DEPTH },
      { id: "transactions", href: "/transactions", icon: "transfer", label: "Transactions", count: HELD_COUNT },
      { id: "orders", href: "/orders", icon: "markets", label: "Orders", count: PENDING_ORDERS_COUNT },
    ],
  },
  {
    label: "Desk",
    items: [
      { id: "audit-log", href: "/audit-log", icon: "doc", label: "Audit log" },
      { id: "staff", href: "/staff", icon: "profile", label: "Staff" },
    ],
  },
];
