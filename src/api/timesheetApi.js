import axios from "./SuperAdmin_axios";

const BASE = "/timesheets";

export const timesheetApi = {
  // 1. Get 5 KPI cards + Daily Grouped History
  getMySummary: async ({ from_date, to_date } = {}) => {
    const params = {};
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
    const { data } = await axios.get(`${BASE}/me`, { params });
    return data;
  },

  // 2. Get Paginated Entries with optional filters
  getMyEntries: async ({ status, from_date, to_date, project, page = 1, limit = 50 } = {}) => {
    const params = { page, limit };
    if (status) params.status = status;
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
    if (project) params.project = project;
    const { data } = await axios.get(`${BASE}/me/entries`, { params });
    return data;
  },

  // 3. Batch Fill Timesheet (Daily / Weekly)
  batchFill: async ({ format_name = "Default", status = "Submitted", days = [] }) => {
    const { data } = await axios.post(`${BASE}/me/entries`, {
      format_name,
      status, // "Draft" | "Submitted"
      days,
    });
    return data;
  },

  // 4. Correct & Resubmit a Draft or Rejected Entry
  correctAndResubmit: async (entryId, payload) => {
    const { data } = await axios.put(`${BASE}/me/entries/${entryId}`, payload);
    return data;
  },

  // 5. Submit an existing Draft Entry
  submitDraft: async (entryId) => {
    const { data } = await axios.post(`${BASE}/me/entries/${entryId}/submit`);
    return data;
  },

  // 6. Delete a Draft Entry
  deleteDraft: async (entryId) => {
    const { data } = await axios.delete(`${BASE}/me/entries/${entryId}`);
    return data;
  },

  // 7. Get FY Year-to-Date (YTD) Analytics
  getMyYtd: async (upto) => {
    const params = {};
    if (upto) params.upto = upto;
    const { data } = await axios.get(`${BASE}/me/ytd`, { params });
    return data;
  },

  // 8. Get Dropdown Metadata (statuses, task statuses, projects, contracted hours)
  getMeta: async () => {
    const { data } = await axios.get(`${BASE}/meta`);
    return data;
  },

  // 9. Get Configured Timesheet Formats
  getFormats: async () => {
    const { data } = await axios.get(`${BASE}/formats`);
    return data;
  },

  // 10. Reviewer Decision (Approve / Reject) — for Managers / Admins
  reviewDecision: async (entryId, { action, remarks = "" }) => {
    const { data } = await axios.post(`${BASE}/entries/${entryId}/decision`, {
      action, // "APPROVE" | "REJECT"
      remarks,
    });
    return data;
  },
};

export default timesheetApi;
