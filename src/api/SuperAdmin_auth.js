
import SuperAdmin_axios from "./SuperAdmin_axios";
import {
  signInSuperAdmin,
  signOut,
} from "@/features/auth/data/auth-session";

const SuperAdmin_auth = {
  // SUPER ADMIN LOGIN
  async login(email, password) {
    const response = await SuperAdmin_axios.post(
      "/auth/super-admins/login",
      { email, password }
    );

    const { access_token, refresh_token } = response.data;

    if (!access_token || !refresh_token) {
      throw new Error(
        "Login response did not contain the expected tokens."
      );
    }

    localStorage.setItem(
      "super_admin_access_token",
      access_token
    );
    localStorage.setItem(
      "super_admin_refresh_token",
      refresh_token
    );

    try {
      signInSuperAdmin(response.data.user);
    } catch (error) {
      localStorage.removeItem("super_admin_access_token");
      localStorage.removeItem("super_admin_refresh_token");
      throw error;
    }

    return response.data;
  },

  // COMPANY APIs
  getCompanies() {
    return SuperAdmin_axios.get("/super-admin/companies");
  },

  createCompany(data) {
    return SuperAdmin_axios.post(
      "/super-admin/companies",
      data
    );
  },

  // BRANCH APIs
  getBranches() {
    return SuperAdmin_axios.get("/super-admin/branches");
  },

  createBranch(data) {
    return SuperAdmin_axios.post(
      "/super-admin/branches",
      data
    );
  },

  // LOGOUT
  logout() {
    signOut();
  },
};

export default SuperAdmin_auth;
