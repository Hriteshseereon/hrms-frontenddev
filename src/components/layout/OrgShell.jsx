import { WorkspaceLoading } from "@/components/common/WorkspaceLoading";
import { usePathname, useRouter } from "@/lib/router";
import { useEffect, useState } from "react";
import { OrgSidebar } from "@/components/layout/OrgSidebar";
import { OrgTopbar } from "@/components/layout/OrgTopbar";
import { AIAssistant } from "@/components/layout/AIAssistant";
import { AccessDenied } from "@/components/common/AccessDenied";
import {
  canOpenPath,
  getCurrentUser,
  useCurrentUser,
  useHydrated,
  useIsSignedIn,
} from "@/features/auth/data/auth-session";
import { cn } from "@/lib/utils";
import { useSessionCutoff } from "@/features/auth/data/session-guard";
import { applyTenantScope } from "@/features/organization/data/group-data";
import { applyBranchScope, lastWorkspacePath } from "@/features/organization/data/tenancy";
import { ScopeGate } from "@/components/layout/ScopeGate";
import { WallpaperLayer } from "@/components/layout/Appearance";

function OrgShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const me = useCurrentUser();
  // Signed-out visitors (after "Sign out", or a fresh browser) used to land in the portal as the default HR identity.
  const signedIn = useIsSignedIn();
  const hydrated = useHydrated();
  // Suspended / revoked / exited accounts lose an already-open session too.
  useSessionCutoff(hydrated);
  const router = useRouter();
  useEffect(() => {
    if (!signedIn) router.replace(lastWorkspacePath());
  }, [signedIn, router]);
  // Tenant lock (Admin / Employee → own company; Super Admin → group view) applied after hydration.
  useEffect(() => {
    applyTenantScope(getCurrentUser());
    applyBranchScope(getCurrentUser());
  }, [me.id]);
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  // Role-based screen guard: admin-portal screens outside the role's scope are blocked.
  const allowed = pathname === "/org" || canOpenPath(me.role, pathname);
  if (!signedIn) return null;
  // Role-dependent UI is rendered only once the browser session is known (see useHydrated).
  if (!hydrated) return <WorkspaceLoading />;
  return (
    <div className="bg-background relative min-h-dvh [html[data-wallpaper=on]_&]:bg-transparent">
      <WallpaperLayer />
      <OrgSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          "glass-main relative z-[1] min-h-dvh transition-all duration-300",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]",
        )}
      >
        <OrgTopbar onMenu={() => setMobileOpen((v) => !v)} />
        <main className="app-main max-w-full min-w-0 overflow-x-hidden p-4 md:p-6 lg:p-8">
          {allowed ? (
            <>
              <ScopeGate />
              {children}
            </>
          ) : (
            <AccessDenied
              role={me.role}
              homeTo={me.role === "Employee" ? "/emp/dashboard" : "/org/dashboard"}
            />
          )}
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}

export default OrgShell;
