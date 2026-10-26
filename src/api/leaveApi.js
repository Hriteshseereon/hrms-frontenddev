import axios from "./SuperAdmin_axios";

const BASE = "/leave";

export const leaveApi = {
  // 1. Leave Balances & Quota (CL, SL, EL, ML/PL, LOP)
  getMyBalances: async (year) => {
    const params = {};
    if (year) params.year = year;
    const { data } = await axios.get(`${BASE}/balances/me`, { params });
    return data;
  },

  // 2. Comp-Off Summary (earned, redeemed, available)
  getMyCompOffSummary: async () => {
    const { data } = await axios.get(`${BASE}/compoff/me`);
    return data;
  },

  // 3. Submit Comp-Off Redemption
  submitCompOffRedemption: async (payload) => {
    const { data } = await axios.post(`${BASE}/compoff/redemptions`, payload);
    return data;
  },

  // 4. Withdraw Comp-Off Redemption
  withdrawCompOffRedemption: async (id) => {
    const { data } = await axios.delete(`${BASE}/compoff/redemptions/${id}`);
    return data;
  },

  // 5. My Leave Requests History
  getMyApplications: async (params = {}) => {
    const { data } = await axios.get(`${BASE}/applications/mine`, { params });
    return data;
  },

  // 6. Get Single Leave Application Detail
  getApplicationDetail: async (id) => {
    const { data } = await axios.get(`${BASE}/applications/${id}`);
    return data;
  },

  // 7. Real-Time Application Validation While Typing
  validateApplication: async (payload) => {
    const { data } = await axios.post(`${BASE}/applications/validate`, payload);
    return data;
  },

  // 8. Apply for Leave
  applyForLeave: async (payload) => {
    const { data } = await axios.post(`${BASE}/applications`, payload);
    return data;
  },

  // 9. Cancel / Withdraw Leave Application
  cancelApplication: async (id) => {
    const { data } = await axios.post(`${BASE}/applications/${id}/cancel`);
    return data;
  },

  // 10. Metadata (reason categories, day parts, statuses)
  getLeaveMetadata: async () => {
    const { data } = await axios.get(`${BASE}/meta`);
    return data;
  },

  // 11. Active Leave Types Policies
  getLeaveTypes: async () => {
    const { data } = await axios.get(`${BASE}/types`);
    return data;
  },

  // 12. Document / Medical Certificate Upload
  uploadLeaveDocument: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await axios.post(`${BASE}/upload`, formData);
    return data;
  },

  // 13. Reviewer Decision (Approve / Reject) for Managers/HR
  decideApplication: async (id, { action, remarks = "" }) => {
    const { data } = await axios.post(`${BASE}/applications/${id}/decision`, {
      action,
      remarks,
    });
    return data;
  },
};

export default leaveApi;
