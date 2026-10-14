import { AppNav } from "@/components/app/nav";
import { navFor, PORTAL_LABEL, portalFor } from "@/lib/portals";
import { requireAuth } from "@/server/auth";
import { logoutAction } from "@/server/session-actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const auth = await requireAuth();
  const items = navFor(auth.permissions);
  const portal = portalFor(auth.permissions);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AppNav
        items={items}
        tenantName={auth.tenant.name}
        userName={auth.name}
        roleName={portal ? `${auth.roleName} · ${PORTAL_LABEL[portal]}` : auth.roleName}
        logout={logoutAction}
      />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
