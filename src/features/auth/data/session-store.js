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
  permittedModules: [],
  isAuthenticated: false,

  // IMPORTANT: Keep created employee IDs distinct from logged-in user session scope
  lastCreatedEmployee: null, // { employeeId, userId, organizationId, companyId, branchId, placementLevel }
};

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
          permitted_modules = [],
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
            signInFromBackend(user);
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
          permittedModules: permitted_modules || [],
          isAuthenticated: Boolean(token),
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
        permittedModules: state.permittedModules,
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
