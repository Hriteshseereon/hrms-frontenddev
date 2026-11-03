// Sidebar module gating: a menu item is shown only when its module key is in `permitted_modules` (list of key strings
// from login / GET /me). Routes that belong to no module (dashboard, profile, settings, …) are always shown.
import { useEffect } from "react";
import { getMe } from "@/api/meApi";
import { useSessionStore } from "./session-store";
import MODULE_ROUTES from "./module-routes.json";

const ROUTE_MODULE = new Map(
  Object.entries(MODULE_ROUTES).flatMap(([key, routes]) => routes.map((r) => [r, key])),
);

export const moduleOfRoute = (to) => ROUTE_MODULE.get(String(to).split("?")[0]) ?? null;

/** Older sessions stored objects; accept both shapes. */
const keysOf = (list) =>
  (Array.isArray(list) ? list : []).map((m) => (typeof m === "string" ? m : (m?.key ?? m?.module_key))).filter(Boolean);

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
