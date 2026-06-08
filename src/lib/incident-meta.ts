import {
  AlertTriangle,
  Truck,
  Package,
  ChefHat,
  MessageSquareWarning,
  Users,
  Droplets,
  ShieldAlert,
  CreditCard,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type IncidentCategory =
  | "pos"
  | "delivery"
  | "inventory"
  | "kitchen"
  | "customer"
  | "staff"
  | "hygiene"
  | "safety"
  | "payment"
  | "other";

export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus =
  | "open"
  | "under_review"
  | "in_progress"
  | "escalated"
  | "resolved"
  | "closed";

export const CATEGORIES: Record<
  IncidentCategory,
  { label: string; icon: LucideIcon; tone: string }
> = {
  pos: { label: "POS Issue", icon: CreditCard, tone: "text-chart-4" },
  delivery: { label: "Delivery Delay", icon: Truck, tone: "text-chart-1" },
  inventory: { label: "Inventory Shortage", icon: Package, tone: "text-gold" },
  kitchen: { label: "Kitchen Equipment", icon: ChefHat, tone: "text-terracotta" },
  customer: { label: "Customer Complaint", icon: MessageSquareWarning, tone: "text-chart-5" },
  staff: { label: "Staff Related", icon: Users, tone: "text-sage" },
  hygiene: { label: "Hygiene Issue", icon: Droplets, tone: "text-chart-2" },
  safety: { label: "Safety Issue", icon: ShieldAlert, tone: "text-destructive" },
  payment: { label: "Payment Issue", icon: CreditCard, tone: "text-chart-3" },
  other: { label: "Other", icon: HelpCircle, tone: "text-muted-foreground" },
};

export const SEVERITY: Record<
  Severity,
  { label: string; bg: string; text: string; ring: string; icon: LucideIcon }
> = {
  low: {
    label: "Low",
    bg: "bg-sage/15",
    text: "text-sage",
    ring: "ring-sage/30",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    bg: "bg-gold/20",
    text: "text-foreground",
    ring: "ring-gold/40",
    icon: AlertTriangle,
  },
  high: {
    label: "High",
    bg: "bg-terracotta/15",
    text: "text-terracotta",
    ring: "ring-terracotta/30",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    bg: "bg-destructive/15",
    text: "text-destructive",
    ring: "ring-destructive/40",
    icon: AlertTriangle,
  },
};

export const STATUS: Record<
  IncidentStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  open: { label: "Open", bg: "bg-chart-4/15", text: "text-chart-4", dot: "bg-chart-4" },
  under_review: { label: "Under Review", bg: "bg-chart-3/15", text: "text-chart-3", dot: "bg-chart-3" },
  in_progress: { label: "In Progress", bg: "bg-gold/20", text: "text-foreground", dot: "bg-gold" },
  escalated: { label: "Escalated", bg: "bg-destructive/15", text: "text-destructive", dot: "bg-destructive" },
  resolved: { label: "Resolved", bg: "bg-sage/20", text: "text-sage", dot: "bg-sage" },
  closed: { label: "Closed", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export const STATUS_ORDER: IncidentStatus[] = [
  "open",
  "under_review",
  "in_progress",
  "escalated",
  "resolved",
  "closed",
];

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as IncidentCategory[];
export const SEVERITY_KEYS = Object.keys(SEVERITY) as Severity[];