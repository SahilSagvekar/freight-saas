import type { Permission } from "./domain";

/**
 * Each person lands in the portal their role fits. Portals are not stored anywhere: they are worked out
 * from the permissions a role grants, so a custom role gets a sensible home without extra setup.
 */
export type PortalKind = "owner" | "manager" | "desk" | "dock" | "cashier" | "viewer";

type Perms = ReadonlySet<Permission> | readonly Permission[];
const has = (perms: Perms, p: Permission) => (Array.isArray(perms) ? (perms as readonly Permission[]).includes(p) : (perms as ReadonlySet<Permission>).has(p));

export function portalFor(perms: Perms): PortalKind | null {
  if (has(perms, "team.manage") || has(perms, "settings.manage")) return "owner";
  if (has(perms, "voyage.manage") || has(perms, "booking.review")) return "manager";
  if (has(perms, "booking.create")) return "desk";
  if (has(perms, "manifest.update")) return "dock";
  if (has(perms, "payment.record") || has(perms, "invoice.view")) return "cashier";
  if (has(perms, "booking.view")) return "viewer";
  return null;
}

export const PORTAL_LABEL: Record<PortalKind, string> = {
  owner: "Owner portal",
  manager: "Operations portal",
  desk: "Ticket desk portal",
  dock: "Dock crew portal",
  cashier: "Cashier portal",
  viewer: "Read-only portal",
};

/** Where `/app` sends each portal. Owners and managers stay on the dashboard. */
export function homeFor(perms: Perms): string | null {
  const portal = portalFor(perms);
  const canSee = has(perms, "booking.view");
  switch (portal) {
    case "owner":
    case "manager":
      return canSee ? "/app" : has(perms, "team.manage") ? "/app/team" : has(perms, "settings.manage") ? "/app/settings" : null;
    case "desk":
      return "/app/desk";
    case "dock":
      return canSee ? "/app/voyages" : null;
    case "cashier":
    case "viewer":
      return canSee ? "/app/bookings" : null;
    default:
      return null;
  }
}

export type NavIcon = "dashboard" | "voyages" | "bookings" | "review" | "settings" | "desk" | "team" | "reports" | "checkin" | "billing";
export type NavEntry = { href: string; label: string; icon: NavIcon };

/** Sidebar links for a set of permissions. Each link appears only when its page would let the person in. */
export function navFor(perms: Perms): NavEntry[] {
  const items: NavEntry[] = [];
  const homeIsDashboard = homeFor(perms) === "/app";
  if (homeIsDashboard) items.push({ href: "/app", label: "Dashboard", icon: "dashboard" });
  if (has(perms, "booking.create")) items.push({ href: "/app/desk", label: "Ticket desk", icon: "desk" });
  if (has(perms, "booking.view")) {
    items.push({ href: "/app/voyages", label: "Voyages", icon: "voyages" });
    items.push({ href: "/app/bookings", label: "Bookings", icon: "bookings" });
  }
  if (has(perms, "manifest.update")) items.push({ href: "/app/checkin", label: "Check-in", icon: "checkin" });
  if (has(perms, "invoice.view")) items.push({ href: "/app/reports", label: "Daily report", icon: "reports" });
  if (has(perms, "booking.review")) items.push({ href: "/app/review", label: "Review queue", icon: "review" });
  if (has(perms, "team.manage")) items.push({ href: "/app/team", label: "Team", icon: "team" });
  if (has(perms, "settings.manage")) items.push({ href: "/app/settings", label: "Settings", icon: "settings" });
  if (has(perms, "settings.manage")) items.push({ href: "/app/billing", label: "Billing", icon: "billing" });
  return items;
}
