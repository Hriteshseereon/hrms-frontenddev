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

export const referralApi = {
  // ==========================================
  // EMPLOYEE SELF-SERVICE ENDPOINTS (/me/referrals)
  // ==========================================

  // 1. List My Referrals & Dashboard KPI Stats
  getMyReferrals: async ({ page = 1, pageSize = 10, search } = {}) => {
    const params = { page, pageSize };
    if (search) params.search = search;
    const { data } = await axios.get("/me/referrals", { params });
    // Returns { items: [...], total, page, pageSize, stats: { referralsMade, inPipeline, hired, totalBonusReceived } }
    return data.data || data;
  },

  // 2. Submit a Candidate Referral
  submitReferral: async (payload) => {
    // payload: { candidateName, email, phone, relationship, jobId, jobTitle, skills, experienceYears, note, cvFileUrl, cvFileName }
    const { data } = await axios.post("/me/referrals", payload);
    return data.data || data;
  },

  // 3. Detail View with Live ATS Pipeline Stage
  getMyReferralDetail: async (id) => {
    const { data } = await axios.get(`/me/referrals/${encodeURIComponent(id)}`);
    return data.data || data;
  },

  // 4. Fetch Active Open Job Postings (For Dropdown)
  getOpenPosts: async () => {
    const { data } = await axios.get("/recruitment/open-posts");
    return data.data || data;
  },

  // ==========================================
  // HR ADMIN ENDPOINTS (/referrals)
  // ==========================================

  // 1. Filterable Referrals List
  getAdminReferrals: async ({ page = 1, pageSize = 10, status, jobId, search } = {}) => {
    const params = { page, pageSize };
    if (status && status !== "all") params.status = status;
    if (jobId && jobId !== "all") params.jobId = jobId;
    if (search) params.search = search;
    const { data } = await axios.get("/referrals", { params });
    return data.data || data;
  },

  // 2. HR Log Referral on Behalf of Employee
  createReferralOnBehalf: async (payload) => {
    // payload: { referrerId, candidateName, email, phone, relationship, jobId, bonusEligible, bonusAmount, skills, experienceYears }
    const { data } = await axios.post("/referrals", payload);
    return data.data || data;
  },

  // 3. Metadata Dropdowns (statuses, relationships)
  getMeta: async () => {
    const { data } = await axios.get("/referrals/meta");
    return data.data || data;
  },

  // 4. Detail View with Full Audit Trail
  getAdminReferralDetail: async (id) => {
    const { data } = await axios.get(`/referrals/${encodeURIComponent(id)}`);
    return data.data || data;
  },

  // 5. Update Pipeline Status
  updateStatus: async (id, status) => {
    const { data } = await axios.patch(`/referrals/${encodeURIComponent(id)}/status`, {
      status,
    });
    return data.data || data;
  },

  // 6. Process & Pay Referral Bonus (Enforces Hired + 90 days retention)
  payBonus: async (id, remarks = "") => {
    const { data } = await axios.post(`/referrals/${encodeURIComponent(id)}/pay-bonus`, {
      remarks: remarks?.trim() || undefined,
    });
    return data.data || data;
  },
};

export default referralApi;
