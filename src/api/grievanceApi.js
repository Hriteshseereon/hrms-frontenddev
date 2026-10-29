import axios from "./SuperAdmin_axios";

// Helper to extract clean error message conforming to RFC 7807 Problem Details
export const getErrorMessage = (error, defaultMsg = "An unexpected error occurred") => {
  if (error.response?.data?.detail) {
    if (typeof error.response.data.detail === "string") {
      return error.response.data.detail;
    }
    if (Array.isArray(error.response.data.detail)) {
      return error.response.data.detail.map((e) => e.msg || e.message).join(", ");
    }
  }
  return error.response?.data?.message || error.response?.data?.title || error.message || defaultMsg;
};

export const grievanceApi = {
  // ==========================================
  // EMPLOYEE SELF-SERVICE ENDPOINTS (/me/grievances)
  // ==========================================

  // 1. List My Grievances
  getMyGrievances: async ({ page = 1, pageSize = 10, status, search } = {}) => {
    const params = { page, pageSize };
    if (status && status !== "all") params.status = status;
    if (search) params.search = search;
    const { data } = await axios.get("/me/grievances", { params });
    // Returns APIResponse<PaginatedData<GrievanceItem>>
    return data.data || data;
  },

  // 2. Submit a New Grievance
  submitGrievance: async (payload) => {
    // payload: { category, severity, subject, description, against, isAnonymous, attachments }
    const { data } = await axios.post("/me/grievances", payload);
    return data.data || data;
  },

  // 3. View Grievance Detail
  getMyGrievanceDetail: async (id) => {
    const { data } = await axios.get(`/me/grievances/${encodeURIComponent(id)}`);
    return data.data || data;
  },

  // 4. Withdraw Grievance
  withdrawGrievance: async (id) => {
    const { data } = await axios.post(`/me/grievances/${encodeURIComponent(id)}/withdraw`, {});
    return data.data || data;
  },

  // 5. Close Grievance (Accept Resolution & Rate CSAT)
  closeGrievance: async (id, { rating, feedback } = {}) => {
    const { data } = await axios.post(`/me/grievances/${encodeURIComponent(id)}/close`, {
      rating: Number(rating),
      feedback: feedback?.trim() || undefined,
    });
    return data.data || data;
  },

  // 6. Appeal Resolution to CHRO
  appealGrievance: async (id, { reason }) => {
    const { data } = await axios.post(`/me/grievances/${encodeURIComponent(id)}/appeal`, {
      reason: reason?.trim(),
    });
    return data.data || data;
  },

  // ==========================================
  // HR ADMIN ENDPOINTS (/grievances)
  // ==========================================

  // 1. Filterable Grievance List
  getAdminGrievances: async ({
    page = 1,
    pageSize = 10,
    status,
    severity,
    category,
    overdue,
    search,
  } = {}) => {
    const params = { page, pageSize };
    if (status && status !== "all") params.status = status;
    if (severity && severity !== "all") params.severity = severity;
    if (category && category !== "all") params.category = category;
    if (overdue) params.overdue = true;
    if (search) params.search = search;
    const { data } = await axios.get("/grievances", { params });
    return data.data || data;
  },

  // 2. Log Grievance on Behalf of Employee
  logOnBehalf: async (payload) => {
    // payload: { employeeId, category, severity, subject, description, against, isAnonymous, attachments }
    const { data } = await axios.post("/grievances", payload);
    return data.data || data;
  },

  // 3. Metadata Dropdowns
  getMeta: async () => {
    const { data } = await axios.get("/grievances/meta");
    return data.data || data;
  },

  // 4. Master SLA Routing Table
  getRouting: async () => {
    const { data } = await axios.get("/grievances/routing");
    return data.data || data;
  },

  // 5. KPI Dashboard Stats
  getStats: async () => {
    const { data } = await axios.get("/grievances/stats");
    return data.data || data;
  },

  // 6. Admin Detail View
  getAdminGrievanceDetail: async (id) => {
    const { data } = await axios.get(`/grievances/${encodeURIComponent(id)}`);
    return data.data || data;
  },

  // 7. Acknowledge Grievance
  acknowledgeGrievance: async (id, { ownerName, committee } = {}) => {
    const { data } = await axios.post(`/grievances/${encodeURIComponent(id)}/acknowledge`, {
      ownerName: ownerName || undefined,
      committee: committee || undefined,
    });
    return data.data || data;
  },

  // 8. Add Investigation Note
  addInvestigationNote: async (id, { note, visibleToEmployee = true }) => {
    const { data } = await axios.post(`/grievances/${encodeURIComponent(id)}/notes`, {
      note: note.trim(),
      visibleToEmployee: Boolean(visibleToEmployee),
    });
    return data.data || data;
  },

  // 9. Resolve Grievance
  resolveGrievance: async (id, { resolution, actionTaken }) => {
    const { data } = await axios.post(`/grievances/${encodeURIComponent(id)}/resolve`, {
      resolution: resolution.trim(),
      actionTaken: actionTaken?.trim() || undefined,
    });
    return data.data || data;
  },

  // 10. Admin Close (Enforces 7-day confirmation window has elapsed)
  adminCloseGrievance: async (id) => {
    const { data } = await axios.post(`/grievances/${encodeURIComponent(id)}/close`, {});
    return data.data || data;
  },
};

export default grievanceApi;
