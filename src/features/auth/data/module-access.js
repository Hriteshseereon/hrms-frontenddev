// Sidebar module gating: a menu item is shown only when its module key is in `permitted_modules` (list of key strings
// from login / GET /me). Routes that belong to no module (dashboard, profile, settings, …) are always shown.
import { useEffect } from "react";
import { getMe } from "@/api/meApi";
import { registerNavExtension } from "./auth-session";
import { useSessionStore } from "./session-store";
import { SCREEN_ROUTES } from "./rbac-store";
import MODULE_ROUTES from "./module-routes.json";

const ROUTE_MODULE = new Map(
  Object.entries(MODULE_ROUTES).flatMap(([key, routes]) => routes.map((r) => [r, key])),
);

export const moduleOfRoute = (to) => ROUTE_MODULE.get(String(to).split("?")[0]) ?? null;

// Employee-portal pages that belong to a CORE module (always enabled for every company) and whose server routes carry
// no module guard (`/emp/promotions/*` is in self_service_router: "self-service for every employee"). A role such as
// Employee Self-Service does not list that module in `permitted_modules`, so without this the page would vanish for
// every imported employee. The module map itself (module-routes.json) mirrors the backend and is left untouched.
const OWN_DATA_ROUTES = new Set(["/emp/movements"]);
const isOwnDataRoute = (to) => OWN_DATA_ROUTES.has(String(to).split("?")[0]);

/** Older sessions stored objects; accept both shapes. */
const keysOf = (list) =>
  (Array.isArray(list) ? list : [])
    .map((m) => (typeof m === "string" ? m : (m?.key ?? m?.module_key)))
    .filter(Boolean);

const isAdminRole = (role) =>
  ["SUPER_ADMIN", "SUPERADMIN", "COMPANY_ADMIN"].includes(String(role ?? "").toUpperCase());

const isSuperRole = (role) =>
  ["SUPER_ADMIN", "SUPERADMIN"].includes(String(role ?? "").toUpperCase());

// Modules every admin portal gets even when the Super Admin has not enabled them for the company (absent from
// `permitted_modules`). Recruitment screens still run on the browser store, so no backend module guard applies yet.
// TODO: once the backend enables these by default for every company, drop this list.
const DEFAULT_ADMIN_MODULES = ["recruitment"];

/** `permitted_modules` keys plus the default admin modules for Company / Super Admin sessions. */
const effectiveModules = (permitted, role) => {
  const keys = keysOf(permitted);
  return isAdminRole(role) ? [...new Set([...keys, ...DEFAULT_ADMIN_MODULES])] : keys;
};

/**
 * Super Admin with no company picked is in organisation mode: the server answers 400 "Select a company" for every
 * company screen and `permitted_modules` is empty, so only the organisation-level screens are offered.
 */
export const isOrgMode = (s = useSessionStore.getState()) =>
  Boolean(s.isAuthenticated) && isSuperRole(s.role) && !s.scopeCompanyId;

export const ORG_MODE_PATHS = [
  "/org/dashboard",
  "/org/groups",
  "/org/company-modules",
  "/org/reports",
  "/org/organisation-setup",
  "/org/settings",
  "/emp/profile",
];
export const isOrgModePath = (to) => {
  const path = String(to).split("?")[0];
  return path === "/org" || ORG_MODE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
};

/** Hook form of `isOrgMode`. */
export function useOrgMode() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const role = useSessionStore((s) => s.role);
  const scopeCompanyId = useSessionStore((s) => s.scopeCompanyId);
  return isOrgMode({ isAuthenticated, role, scopeCompanyId });
}

/** `can("employee.edit")` — module level "<module>.view|edit|delete", screen level "<screen_code>.view|edit|delete". */
export function canDo(permission, s = useSessionStore.getState()) {
  if (!s.isAuthenticated) return true; // mock / signed-out preview
  if (isAdminRole(s.role)) return true; // admins hold everything in their scope; the backend still enforces
  // HR prepares monthly payroll runs; approval and processing remain separate permissions.
  if (permission === "payroll.run") {
    const roles = [s.role, ...(Array.isArray(s.roles) ? s.roles : [])].map((role) =>
      String(typeof role === "string" ? role : (role?.name ?? "")).trim(),
    );
    if (roles.some((name) => /\bhr\b|human resource|\bchro\b|payroll admin/i.test(name)))
      return true;
  }
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

/* ------------------------------------------------------------------ */
/* Assigned modules: the screens ticked in the Permission Matrix       */
/* ------------------------------------------------------------------ */

// Employee-portal page of the own-data screens (the Employee Self-Service set, `self_service: true`).
const SELF_SCREEN_ROUTES = {
  "org-dashboard": "/emp/dashboard",
  "employee-profile": "/emp/profile",
  referrals: "/emp/referrals",
  "employee-docs": "/emp/profile",
  "attendance-log": "/emp/attendance",
  regularization: "/emp/attendance",
  "leave-requests": "/emp/leave",
  "leave-balance": "/emp/leave",
  "holiday-calendar": "/emp/holidays",
  "timesheet-log": "/emp/timesheets",
  payslips: "/emp/payslips",
  "loan-requests": "/emp/loans",
  reimbursements: "/emp/reimbursements",
  complaints: "/emp/complaints",
  "support-tickets": "/helpdesk",
  announcements: "/emp/notices",
  policies: "/emp/handbook",
};

/**
 * Every screen the user's roles grant (`assigned_modules` from login / refresh / GET /me), in Permission Matrix
 * order, each with the page it opens:
 *  - a module the role manages (it holds a screen there beyond the own-data ones, e.g. Leave Approvals or the
 *    HR Manager's Shift Master) opens the organisation page of every screen of that module;
 *  - a module where only own-data screens are ticked (e.g. the Manager's payslips) opens the employee-portal page.
 * Returns [{ id, label, section, module, to, alt, view, edit, delete }]; `alt` is the other page, tried when `to` is closed.
 */
export function assignedScreens(s = useSessionStore.getState()) {
  const out = [];
  for (const mod of Array.isArray(s.assignedModules) ? s.assignedModules : []) {
    const screens = (mod.submodules ?? []).flatMap((sub) => sub.screens ?? []);
    const manages = screens.some((sc) => !sc.self_service);
    for (const sc of screens) {
      const org = SCREEN_ROUTES[sc.key] ?? null;
      const own = sc.self_service ? (SELF_SCREEN_ROUTES[sc.key] ?? null) : null;
      const [to, alt] = manages || !own ? [org ?? own, own] : [own, org];
      if (!to) continue;
      out.push({
        id: sc.screen_code,
        label: sc.name,
        section: mod.name,
        module: mod.key,
        to,
        alt: alt && alt !== to ? alt : null,
        view: Boolean(sc.view),
        edit: Boolean(sc.edit),
        delete: Boolean(sc.delete),
      });
    }
  }
  return out;
}

/** Hook form of `assignedScreens`; `loaded` is false when the backend did not send `assigned_modules`. */
export function useAssignedScreens() {
  const assignedModules = useSessionStore((s) => s.assignedModules);
  return { loaded: Array.isArray(assignedModules), screens: assignedScreens({ assignedModules }) };
}

const matchesRoute = (pathname, route) => pathname === route || pathname.startsWith(`${route}/`);

// A role can give a plain employee login the org screens of its modules: with Admin portal access
// (redirect_portal "org") the whole admin portal, otherwise just the module screens the role grants
// (listed under "Assigned modules" in the employee portal). On top of the built-in role matrix.
registerNavExtension((_user, pathname) => {
  const s = useSessionStore.getState();
  if (!s.isAuthenticated || !pathname.startsWith("/org")) return false;
  if (isOrgMode(s)) return isOrgModePath(pathname);
  const adminPortal = s.redirectPortal === "org";
  if (adminPortal && pathname === "/org/dashboard") return true;
  const key = moduleOfRoute(pathname);
  const permitted = effectiveModules(s.permittedModules, s.role);
  // The organisation page of a screen ticked for one of the user's roles (also pages that belong to no module,
  // such as Timesheets or the Holiday Calendar). A page of a module the company switched off stays closed.
  if (
    (!key || permitted.includes(key)) &&
    assignedScreens(s).some((sc) => sc.to.startsWith("/org") && matchesRoute(pathname, sc.to))
  )
    return true;
  if (!key || !permitted.includes(key)) return false;
  return adminPortal || isAdminRole(s.role) || grantedModules(s).has(key);
});

/** Route guard: false when the path belongs to a module that is not in `permitted_modules`. */
export function useRouteModuleOk(pathname) {
  const permitted = useSessionStore((s) => s.permittedModules);
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  const loaded = useSessionStore((s) => s.accessLoaded);
  const role = useSessionStore((s) => s.role);
  const orgMode = useOrgMode();
  if (orgMode) return isOrgModePath(pathname);
  if (isOwnDataRoute(pathname)) return true;
  const key = moduleOfRoute(pathname);
  return !apiSession || !loaded || !key || effectiveModules(permitted, role).includes(key);
}

/** Returns `(to) => boolean`: true when the route's module is enabled (or the route has no module). */
export function useModuleAccess() {
  const permitted = useSessionStore((s) => s.permittedModules);
  const apiSession = useSessionStore((s) => s.isAuthenticated);
  // Keep modules / company / branch fresh: Super Admin may have switched modules since this user signed in.
  useEffect(() => {
    if (!apiSession) return;
    getMe()
      .then((me) => {
        if (import.meta.env.DEV)
          console.info("[/me] response", {
            role: me?.user?.role ?? me?.role,
            portal: me?.redirect_portal,
            company: me?.company?.name,
            permitted_modules: me?.permitted_modules,
            permissions: me?.permissions?.length,
          });
        useSessionStore.getState().applyMe(me);
      })
      .catch(() => {});
  }, [apiSession]);
  const role = useSessionStore((s) => s.role);
  const permissions = useSessionStore((s) => s.permissions);
  const keys = new Set(effectiveModules(permitted, role));
  const orgMode = useOrgMode();
  return (to) => {
    if (!apiSession) return true; // mock / signed-out preview: no API session to gate by
    if (orgMode) return isOrgModePath(to);
    if (isOwnDataRoute(to)) return true;
    const key = moduleOfRoute(to);
    if (key && !keys.has(key)) return false;
    // Organization payroll actions need a payroll.* permission. Employee routes such as
    // payslips, tax documents and loans are self-service; the enabled company module is enough.
    if (key === "payroll" && String(to).startsWith("/org/") && !isAdminRole(role))
      return (permissions ?? []).some((p) => String(p).startsWith("payroll."));
    return true;
  };
}
