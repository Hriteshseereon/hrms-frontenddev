import SuperAdmin_axios from "./SuperAdmin_axios";

/**
 * Extracts a human-readable error message from RFC 7807 problem details
 * or standard backend response envelopes.
 */
export function extractErrorMessage(error) {
  if (error?.response?.data?.detail) {
    if (typeof error.response.data.detail === "string") {
      return error.response.data.detail;
    }
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail
        .map((d) => d.msg || JSON.stringify(d))
        .join("; ");
    }
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  return error?.message || "An unexpected error occurred.";
}

export const rbacApi = {
  // 1. Fetch screen tree, actions, and managed branches meta
  getRoleMeta: async () => {
    const res = await SuperAdmin_axios.get("/roles/meta");
    return res.data?.data ?? res.data;
  },

  // 2. List all roles with user count and screen count
  getRoles: async () => {
    const res = await SuperAdmin_axios.get("/roles");
    return res.data?.data ?? res.data;
  },

  // 3. Get single role details by ID
  getRoleById: async (rid) => {
    const res = await SuperAdmin_axios.get(`/roles/${encodeURIComponent(rid)}`);
    return res.data?.data ?? res.data;
  },

  // 4. Create new custom role
  createRole: async (payload) => {
    const res = await SuperAdmin_axios.post("/roles", payload);
    return res.data?.data ?? res.data;
  },

  // 5. Update existing role
  updateRole: async (rid, payload) => {
    const res = await SuperAdmin_axios.put(`/roles/${encodeURIComponent(rid)}`, payload);
    return res.data?.data ?? res.data;
  },

  // 6. Delete role
  deleteRole: async (rid) => {
    const res = await SuperAdmin_axios.delete(`/roles/${encodeURIComponent(rid)}`);
    return res.data?.data ?? res.data;
  },

  // 7. Toggle role status between 'Active' and 'Draft'
  toggleRoleStatus: async (rid, status) => {
    const res = await SuperAdmin_axios.post(`/roles/${encodeURIComponent(rid)}/status`, { status });
    return res.data?.data ?? res.data;
  },

  // 8. Get Comparison Permission Matrix Grid
  getPermissionMatrix: async () => {
    const res = await SuperAdmin_axios.get("/roles/matrix");
    return res.data?.data ?? res.data;
  },

  // 9. List User Role Assignments (supports /roles/assignments and /user-branch-roles)
  getUserRoleAssignments: async () => {
    try {
      const res = await SuperAdmin_axios.get("/roles/assignments");
      return res.data?.data ?? res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await SuperAdmin_axios.get("/user-branch-roles");
        return res.data?.data ?? res.data;
      }
      throw err;
    }
  },

  // 10. Assign user to role on branches
  assignUserRole: async (payload) => {
    try {
      const res = await SuperAdmin_axios.post("/roles/assignments", payload);
      return res.data?.data ?? res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await SuperAdmin_axios.post("/user-branch-roles", payload);
        return res.data?.data ?? res.data;
      }
      throw err;
    }
  },

  // 11. Bulk update branch access for user
  bulkUpdateBranchAccess: async (uid, payload) => {
    const res = await SuperAdmin_axios.put(`/roles/branch-access/${encodeURIComponent(uid)}`, payload);
    return res.data?.data ?? res.data;
  },

  // 12. Grant role on branches for a specific user
  grantUserRole: async (uid, payload) => {
    const res = await SuperAdmin_axios.post(`/users/${encodeURIComponent(uid)}/roles`, payload);
    return res.data?.data ?? res.data;
  },

  // 13. Revoke role assignment (DELETE /roles/assignments/:id or /user-branch-roles/:id)
  revokeAssignment: async (assignmentId) => {
    try {
      const res = await SuperAdmin_axios.delete(`/roles/assignments/${encodeURIComponent(assignmentId)}`);
      return res.data?.data ?? res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await SuperAdmin_axios.delete(`/user-branch-roles/${encodeURIComponent(assignmentId)}`);
        return res.data?.data ?? res.data;
      }
      throw err;
    }
  },

  // Backward compatibility alias for revokeUserRole
  revokeUserRole: async (uid, rid) => {
    const targetId = rid || uid;
    try {
      const res = await SuperAdmin_axios.delete(`/roles/assignments/${encodeURIComponent(targetId)}`);
      return res.data?.data ?? res.data;
    } catch {
      const res = await SuperAdmin_axios.delete(`/user-branch-roles/${encodeURIComponent(targetId)}`);
      return res.data?.data ?? res.data;
    }
  },

  // 14. Get Reporting Lines for an employee (supports /reporting-lines/:id and /employees/:id/reporting-lines)
  getReportingLines: async (employeeId) => {
    try {
      const res = await SuperAdmin_axios.get(`/reporting-lines/${encodeURIComponent(employeeId)}`);
      return res.data?.data ?? res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await SuperAdmin_axios.get(`/employees/${encodeURIComponent(employeeId)}/reporting-lines`);
        return res.data?.data ?? res.data;
      }
      throw err;
    }
  },

  // 15. Update Reporting Lines for an employee
  updateReportingLines: async (employeeId, payload) => {
    try {
      const res = await SuperAdmin_axios.put(`/reporting-lines/${encodeURIComponent(employeeId)}`, payload);
      return res.data?.data ?? res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await SuperAdmin_axios.put(`/employees/${encodeURIComponent(employeeId)}/reporting-lines`, payload);
        return res.data?.data ?? res.data;
      }
      throw err;
    }
  },
};

export default rbacApi;
