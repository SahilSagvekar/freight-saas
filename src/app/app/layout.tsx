import { AppNav, type NavItem } from "@/components/app/nav";
import { can, requireAuth } from "@/server/auth";
import { logoutAction } from "@/server/session-actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const auth = await requireAuth();
  const items: NavItem[] = [{ href: "/app", label: "Dashboard", icon: "dashboard" }];
  if (can(auth, "booking.create")) items.push({ href: "/app/desk", label: "Ticket desk", icon: "desk" });
  items.push({ href: "/app/voyages", label: "Voyages", icon: "voyages" });
  items.push({ href: "/app/bookings", label: "Bookings", icon: "bookings" });
  items.push({ href: "/app/review", label: "Review queue", icon: "review" });
  if (can(auth, "settings.manage")) items.push({ href: "/app/settings", label: "Settings", icon: "settings" });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AppNav items={items} tenantName={auth.tenant.name} userName={auth.name} roleName={auth.roleName} logout={logoutAction} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
