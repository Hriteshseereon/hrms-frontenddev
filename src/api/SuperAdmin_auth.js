import SuperAdmin_axios from "./SuperAdmin_axios";
import { useSessionStore } from "@/features/auth/data/session-store";
import { signInSuperAdmin, signOut } from "@/features/auth/data/auth-session";

const SuperAdmin_auth = {
  // LOGIN (supports POST /auth/login and falls back to /auth/super-admins/login)
  async login(email, password) {
    let response;
    try {
      response = await SuperAdmin_axios.post("/auth/login", { email, password });
    } catch (err) {
      if (err.response?.status === 404) {
        response = await SuperAdmin_axios.post("/auth/super-admins/login", { email, password });
      } else {
        throw err;
      }
    }

    const { access_token, refresh_token } = response.data;

    if (!access_token) {
      throw new Error("Login response did not contain the expected tokens.");
    }

    localStorage.setItem("super_admin_access_token", access_token);
    localStorage.setItem("access_token", access_token);
    if (refresh_token) {
      localStorage.setItem("super_admin_refresh_token", refresh_token);
      localStorage.setItem("refresh_token", refresh_token);
    }

    // Save user scope and identity in Zustand session store
    useSessionStore.getState().setSession(response.data);

    try {
      signInSuperAdmin(response.data.user);
    } catch {
      // ignore if non-critical
    }

    return response.data;
  },

  // COMPANY APIs
  getCompanies() {
    return SuperAdmin_axios.get("/super-admin/companies");
  },

  createCompany(data) {
    return SuperAdmin_axios.post("/super-admin/companies", data);
  },

  // BRANCH APIs
  getBranches(companyId = null) {
    return SuperAdmin_axios.get("/super-admin/branches", {
      params: companyId ? { company_id: companyId } : {},
    });
  },

  createBranch(data) {
    return SuperAdmin_axios.post("/super-admin/branches", data);
  },

  // LOGOUT
  logout() {
    useSessionStore.getState().clearSession();
    signOut();
  },
};

export default SuperAdmin_auth;
