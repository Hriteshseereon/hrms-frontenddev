import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useCurrentUser, can } from "@/features/auth/data/auth-session";
import { useSessionStore } from "@/features/auth/data/session-store";
import { useCanScreen, useScreenScope } from "@/features/auth/data/module-access";
import { rbacApi } from "@/api/rbacApi";

export const PermissionContext = createContext({
  isSuperAdmin: false,
  permissions: {},
  loading: false,
  refreshPermissions: () => {},
});

export function PermissionProvider({ children }) {
  const me = useCurrentUser();
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = useMemo(() => {
    if (!me) return false;
    const r = (me.role || "").toLowerCase();
    return r === "superadmin" || r === "super_admin" || r === "organization admin" || me.isSuperAdmin === true;
  }, [me]);

  const fetchPermissions = async () => {
    if (!me?.id || isSuperAdmin) return;
    try {
      setLoading(true);
      // If user holds a role, or we can fetch their effective assignments
      if (me.roleId) {
        const roleData = await rbacApi.getRoleById(me.roleId);
        if (roleData?.permissions) {
          setPermissions(roleData.permissions);
        }
      }
    } catch {
      // Fallback gracefully without breaking UI
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [me?.id, me?.roleId, isSuperAdmin]);

  const value = useMemo(
    () => ({
      isSuperAdmin,
      permissions,
      loading,
      refreshPermissions: fetchPermissions,
    }),
    [isSuperAdmin, permissions, loading],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/**
 * Hook to verify if the active user holds permission for a screen & action.
 * @param {string} screenCode The screen_code supplied by RBAC, e.g. "employee.employee-management.all-employees".
 * @param {string} [action="View"] Any action configured for the screen (Create, Export, Approve, or a future action).
 * @returns {boolean}
 */
export function usePermission(screenCode, action = "View") {
  const me = useCurrentUser();
  const { isSuperAdmin, permissions } = useContext(PermissionContext);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const canOnScreen = useCanScreen();

  // Backend login/GET /me is the effective grant source. Never fall back to the mock role matrix
  // for an authenticated API session: that made buttons disagree with the permissions selected in RBAC.
  if (isAuthenticated) return canOnScreen(screenCode, action);

  if (isSuperAdmin) return true;

  // 1. Check granular screen permission map if present
  if (permissions && permissions[screenCode]) {
    const act = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
    if (permissions[screenCode][act] !== undefined) {
      return Boolean(permissions[screenCode][act]);
    }
  }

  // 2. Fallback to existing legacy role check in auth-session.js
  if (me?.role) {
    if (action === "View") return true;
    if (action === "Edit" || action === "Delete") {
      return can(me.role, "role.manage") || me.role === "Admin" || me.role === "HR";
    }
  }

  return false;
}

/**
 * Declarative UI gate. Use the same screen_code and action label as RBAC_MODULES; action names are not hard-coded here.
 */
export function Can({ screen, action = "View", children, fallback = null }) {
  const scoped = useScreenScope();
  const allowed = usePermission(screen ?? scoped, action);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

export default usePermission;
