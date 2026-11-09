// Sidebar module gating: a menu item is shown only when its module key is in `permitted_modules` (list of key strings
// from login / GET /me). Routes that belong to no module (dashboard, profile, settings, …) are always shown.
import { useEffect } from "react";
import { getMe } from "@/api/meApi";
import { registerNavExtension } from "./auth-session";
import { useSessionStore } from "./session-store";
import MODULE_ROUTES from "./module-routes.json";

const ROUTE_MODULE = new Map(
  Object.entries(MODULE_ROUTES).flatMap(([key, routes]) => routes.map((r) => [r, key])),
);

export const moduleOfRoute = (to) => ROUTE_MODULE.get(String(to).split("?")[0]) ?? null;

/** Older sessions stored objects; accept both shapes. */
const keysOf = (list) =>
  (Array.isArray(list) ? list : []).map((m) => (typeof m === "string" ? m : (m?.key ?? m?.module_key))).filter(Boolean);

const isAdminRole = (role) =>
  ["SUPER_ADMIN", "SUPERADMIN", "COMPANY_ADMIN"].includes(String(role ?? "").toUpperCase());

/** `can("employee.edit")` — module level "<module>.view|edit|delete", screen level "<screen_code>.view|edit|delete". */
export function canDo(permission, s = useSessionStore.getState()) {
  if (!s.isAuthenticated) return true; // mock / signed-out preview
  if (isAdminRole(s.role)) return true; // admins hold everything in their scope; the backend still enforces
  const list = Array.isArray(s.permissions) ? s.permissions : [];
  return list.includes("*") || list.includes(permission);
}

/** Hook form of `canDo`: `const can = useCan(); {can("employee.edit") && <EditButton />}`. */
export function useCan() {
  const permissions = useSessionStore((s) => s.permissions);
  const role = useSessionStore((s) => s.role);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  return (permission) => canDo(permission, { permissions, role, isAuthenticated });
}

/** Branch ids the user may pick, or null for every branch (`branch_scope` "ALL"). */
export function useBranchScope() {
  const scope = useSessionStore((s) => s.branchScope);
  return Array.isArray(scope) ? scope.map(String) : null;
}

/** Module keys the user's roles grant something in (from "<module>.view|edit|delete" and "<module>.<screen>…"). */
export function grantedModules(s = useSessionStore.getState()) {
  return new Set(
    (Array.isArray(s.permissions) ? s.permissions : []).map((p) => String(p).split(".")[0]),
  );
}

// A role can give a plain employee login the org screens of its modules: with Admin portal access
// (redirect_portal "org") the whole admin portal, otherwise just the module screens the role grants
// (listed under "Assigned modules" in the employee portal). On top of the built-in role matrix.
registerNavExtension((_user, pathname) => {
  const s = useSessionStore.getState();
  if (!s.isAuthenticated || !pathname.startsWith("/org")) return false;
  const adminPortal = s.redirectPortal === "org";
  if (adminPortal && pathname === "/org/dashboard") return true;
  const key = moduleOfRoute(pathname);
  if (!key || !keysOf(s.permittedModules).includes(key)) return false;
  return adminPortal || grantedModules(s).has(key);
});

/** Route guard: false when the path belongs to a module that is not in `permitted_modules`. */
export function useRouteModuleOk(pathname) {
  const permitted = useSessionStore((s) => s.permittedModules);
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  const loaded = useSessionStore((s) => s.accessLoaded);
  const key = moduleOfRoute(pathname);
  return !apiSession || !loaded || !key || keysOf(permitted).includes(key);
}

/** Returns `(to) => boolean`: true when the route's module is enabled (or the route has no module). */
export function useModuleAccess() {
  const permitted = useSessionStore((s) => s.permittedModules);
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  // Keep modules / company / branch fresh: Super Admin may have switched modules since this user signed in.
  useEffect(() => {
    if (!apiSession) return;
    getMe()
      .then((me) => useSessionStore.getState().applyMe(me))
      .catch(() => {});
  }, [apiSession]);
  const keys = new Set(keysOf(permitted));
  return (to) => {
    if (!apiSession) return true; // mock / signed-out preview: no API session to gate by
    const key = moduleOfRoute(to);
    return !key || keys.has(key);
  };
}
