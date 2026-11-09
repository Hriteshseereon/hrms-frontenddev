
import SuperAdmin_axios from "./SuperAdmin_axios";

const Branch_api = {
  // GET: List branches, optionally filtered by company
  async getBranches(companyId = null) {
    const params = companyId ? { company_id: companyId } : {};
    try {
      return await SuperAdmin_axios.get("/super-admin/branches", { params });
    } catch (err) {
      if (err?.response?.status === 404 || err?.response?.status === 403) {
        return await SuperAdmin_axios.get("/branches", { params });
      }
      throw err;
    }
  },

  // GET: Single branch details
  getBranch(branchId) {
    return SuperAdmin_axios.get(`/super-admin/branches/${branchId}`);
  },

  // POST: Create a branch under a company
  createBranch(data) {
    return SuperAdmin_axios.post("/super-admin/branches", data);
  },

  // PUT: Update branch
  updateBranch(branchId, data) {
    return SuperAdmin_axios.put(`/super-admin/branches/${branchId}`, data);
  },

  // POST: create or replace the Branch Admin (the old one is deactivated)
  setBranchAdmin(branchId, data) {
    return SuperAdmin_axios.post(`/super-admin/branches/${branchId}/admin`, data);
  },

  // POST: new temporary password for the Branch Admin (shown once)
  resetBranchAdminPassword(branchId) {
    return SuperAdmin_axios.post(`/super-admin/branches/${branchId}/admin/reset-password`);
  },

  // DELETE: Delete branch
  deleteBranch(branchId) {
    return SuperAdmin_axios.delete(`/super-admin/branches/${branchId}`);
  },
};

export default Branch_api;
