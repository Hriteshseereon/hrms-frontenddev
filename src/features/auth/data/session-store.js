import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { signInFromBackend, signOut as authSessionSignOut } from "./auth-session";

const INITIAL_STATE = {
  accessToken: null,
  refreshToken: null,
  tokenType: "bearer",
  userId: null, // login user.id (users table ID, NOT employee ID)
  email: null,
  fullName: null,
  role: null, // "SUPER_ADMIN" | "COMPANY_ADMIN" | "BRANCH_ADMIN" | "EMPLOYEE"
  organizationId: null, // user.organization_id (logged-in session scope)
  companyId: null, // user.company_id (logged-in session scope)
  branchId: null, // user.branch_id (logged-in session scope)
  isBranchEmployee: false,
  status: null,
  // Access (login / refresh / GET /me). Not persisted: re-read from GET /me on every app load.
  permittedModules: [], // module keys, e.g. ["employee", "attendance"]
  roles: [], // [{ id, name }] — empty for an employee with no role
  permissions: [], // "employee.edit", "<screen_code>.view", ...
  branchScope: "ALL", // "ALL" or an array of branch ids
  accessLoaded: false, // true once the access fields above came from the backend in this page load
  accessError: null, // { reason: "module" | "permission", path } — set by a 403 from the API client
  companyName: null, // company.name from login / GET /me
  scopeCompanyId: "", // Super Admin: company chosen on the per-company master screens
  branchName: null, // branch.name (null for company-level users)
  redirectPortal: null, // "org" | "emp" — decided by the backend at login
  designationType: null, // "HR" | "MANAGER" | "CEO" | null
  mustChangePassword: false,
  isAuthenticated: false,

  // IMPORTANT: Keep created employee IDs distinct from logged-in user session scope
  lastCreatedEmployee: null, // { employeeId, userId, organizationId, companyId, branchId, placementLevel }
};

/**
 * Access fields from a login / refresh / GET /me body. `onlyPresent` (GET /me, refresh) leaves a field
 * untouched when the body does not carry it; login resets it to "nothing granted".
 */
function accessFields(body, onlyPresent = false) {
  const out = {};
  const put = (key, value, ok) => {
    if (ok) out[key] = value;
    else if (!onlyPresent) out[key] = INITIAL_STATE[key];
  };
  put("permittedModules", body?.permitted_modules, Array.isArray(body?.permitted_modules));
  put("accessLoaded", true, Array.isArray(body?.permitted_modules));
  put("roles", body?.roles, Array.isArray(body?.roles));
  put("permissions", body?.permissions, Array.isArray(body?.permissions));
  put(
    "branchScope",
    body?.branch_scope,
    body?.branch_scope === "ALL" || Array.isArray(body?.branch_scope),
  );
  return out;
}

export const useSessionStore = create()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      /**
       * Stores access token and user identity / tenant scope from the backend login response.
       * Bridges with existing auth-session and localStorage tokens.
       */
      setSession: (loginResponse) => {
        if (!loginResponse) return;
        const {
          access_token,
          refresh_token,
          token_type = "bearer",
          user = {},
          redirect_portal = null,
        } = loginResponse;

        const token = access_token || "";
        const refresh = refresh_token || "";

        // Synchronize with existing localStorage keys used across the app
        if (typeof window !== "undefined") {
          if (token) {
            localStorage.setItem("super_admin_access_token", token);
            localStorage.setItem("access_token", token);
          }
          if (refresh) {
            localStorage.setItem("super_admin_refresh_token", refresh);
            localStorage.setItem("refresh_token", refresh);
          }
        }

        // Bridge user into legacy auth-session for portal guards & navigation
        try {
          if (user?.id) {
            signInFromBackend(user, { portal: redirect_portal });
          }
        } catch (e) {
          console.warn("Could not sync session with legacy auth-session:", e);
        }

        set({
          accessToken: token,
          refreshToken: refresh,
          tokenType: token_type,
          userId: user.id || null, // Note: userId is users-table ID, NOT employee_id
          email: user.email || null,
          fullName: user.full_name || user.name || null,
          role: user.role || null,
          organizationId: user.organization_id || null,
          companyId: user.company_id || null,
          branchId: user.branch_id || null,
          isBranchEmployee: Boolean(user.is_branch_employee),
          status: user.status || null,
          ...accessFields(loginResponse),
          redirectPortal: redirect_portal,
          companyName: loginResponse.company?.name ?? null,
          branchName: loginResponse.branch?.name ?? null,
          designationType: user.designation_type || null,
          mustChangePassword: Boolean(
            loginResponse.must_change_password ?? user.must_change_password,
          ),
          isAuthenticated: Boolean(token),
        });
      },

      /** Refreshes modules / company / branch from GET /me (call after any change to them). */
      applyMe: (me) => {
        if (!me) return;
        set({
          ...accessFields(me, true),
          // GET /me says whether the temporary-password lock still applies (also after a reload).
          ...(typeof (me.must_change_password ?? me.user?.must_change_password) === "boolean"
            ? { mustChangePassword: me.must_change_password ?? me.user.must_change_password }
            : {}),
          ...(me.redirect_portal === "org" || me.redirect_portal === "emp"
            ? { redirectPortal: me.redirect_portal }
            : {}),
          companyName: me.company?.name ?? null,
          branchName: me.branch?.name ?? null,
        });
      },

      /**
       * Clears session, tokens and user scope on logout.
       */
      clearSession: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("super_admin_access_token");
          localStorage.removeItem("super_admin_refresh_token");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }

        try {
          authSessionSignOut();
        } catch {
          // ignore
        }

        set({ ...INITIAL_STATE });
      },

      /**
       * Records the response of a newly created employee.
       * Kept strictly separate from the logged-in user's scope.
       */
      setLastCreatedEmployee: (createdData) => {
        if (!createdData) {
          set({ lastCreatedEmployee: null });
          return;
        }

        set({
          lastCreatedEmployee: {
            employeeId: createdData.id ?? createdData.employee_id ?? null,
            userId: createdData.user_id ?? null,
            organizationId: createdData.organization_id ?? null,
            companyId: createdData.company_id ?? null,
            branchId: createdData.branch_id ?? null,
            placementLevel: createdData.placement_level ?? null,
          },
        });
      },

      clearLastCreatedEmployee: () => {
        set({ lastCreatedEmployee: null });
      },
    }),
    {
      name: "seereon.auth.session.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenType: state.tokenType,
        userId: state.userId,
        email: state.email,
        fullName: state.fullName,
        role: state.role,
        organizationId: state.organizationId,
        companyId: state.companyId,
        branchId: state.branchId,
        isBranchEmployee: state.isBranchEmployee,
        status: state.status,
        redirectPortal: state.redirectPortal,
        companyName: state.companyName,
        branchName: state.branchName,
        designationType: state.designationType,
        mustChangePassword: state.mustChangePassword,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

/**
 * Helper to check if a role is allowed to create employees.
 * An EMPLOYEE is strictly forbidden from creating other employees.
 */
export function canCreateEmployee(role) {
  if (!role) return false;
  const normalized = String(role).toUpperCase();
  return (
    normalized === "SUPER_ADMIN" ||
    normalized === "SUPERADMIN" ||
    normalized === "COMPANY_ADMIN" ||
    normalized === "ADMIN" ||
    normalized === "BRANCH_ADMIN" ||
    normalized === "BRANCHADMIN"
  );
}
