import { IconName } from "@/components/icons/Icon";

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
      { id: "kyc", href: "/kyc", icon: "shield", label: "KYC review" },
      { id: "transactions", href: "/transactions", icon: "transfer", label: "Transactions" },
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
