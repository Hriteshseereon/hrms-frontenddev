import { useSessionStore } from "@/features/auth/data/session-store";
import { WorkspaceLoading } from "@/components/common/WorkspaceLoading";
import { usePathname, useRouter } from "@/lib/router";
import { useEffect, useState } from "react";
import { EmpSidebar } from "@/components/layout/EmpSidebar";
import { EmpTopbar } from "@/components/layout/EmpTopbar";
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
import { ForcePasswordChange } from "@/features/auth/components/ForcePasswordChange";
import { useOrgMode, useRouteModuleOk } from "@/features/auth/data/module-access";
import { useSessionCutoff } from "@/features/auth/data/session-guard";
import { applyTenantScope } from "@/features/organization/data/group-data";
import { applyBranchScope, lastWorkspacePath } from "@/features/organization/data/tenancy";
import { WallpaperLayer } from "@/components/layout/Appearance";

function EmpShell({ children }) {
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
  useEffect(() => {
    applyTenantScope(getCurrentUser());
    applyBranchScope(getCurrentUser());
  }, [me.id]);
  const pathname = usePathname();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  const moduleOk = useRouteModuleOk(pathname);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);
  const accessError = useSessionStore((s) => s.accessError);
  const deniedReason = accessError?.path === pathname ? accessError.reason : null;
  const allowed = !deniedReason && (pathname === "/emp" || (moduleOk && canOpenPath(me.role, pathname)));
  // A route whose module is not in permitted_modules goes home straight away — no API call, no wait for a 403.
  const orgMode = useOrgMode();
  useEffect(() => {
    const home = orgMode ? "/org/dashboard" : "/emp/dashboard";
    if (signedIn && hydrated && !moduleOk && pathname !== home) router.replace(home);
  }, [signedIn, hydrated, moduleOk, orgMode, pathname, router]);
  if (!signedIn) return null;
  // Temporary password: only the change screen renders until it is changed (nothing else may call the API).
  if (mustChangePassword) return <ForcePasswordChange />;
  // Role-dependent UI is rendered only once the browser session is known (see useHydrated).
  if (!hydrated) return <WorkspaceLoading />;
  return (
    <div className="bg-background relative min-h-dvh [html[data-wallpaper=on]_&]:bg-transparent">
      <WallpaperLayer />
      <EmpSidebar
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
        <EmpTopbar onMenu={() => setMobileOpen((v) => !v)} />
        <main className="app-main max-w-full min-w-0 overflow-x-hidden p-4 md:p-6 lg:p-8">
          {allowed ? (
            <>{children}</>
          ) : (
            <AccessDenied
              role={me.role}
              reason={deniedReason ?? (moduleOk ? undefined : "module")}
              info={deniedReason ? accessError.info : undefined}
              homeTo="/emp/dashboard"
            />
          )}
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}

export default EmpShell;
