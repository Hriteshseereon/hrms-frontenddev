import axios from "./SuperAdmin_axios";

const BASE = "/attendance";

export const attendanceApi = {
  // 1. Mark Punch In
  punchIn: async (
    payload = {
      source: "MANUAL",
      device_id: null,
      location_name: null,
      note: "",
    },
  ) => {
    const { data } = await axios.post(`${BASE}/punch-in`, payload);
    return data;
  },

  // 2. Mark Punch Out
  punchOut: async (payload = { note: "" }) => {
    const { data } = await axios.post(`${BASE}/punch-out`, payload);
    return data;
  },

  // 3. Get Today's Live Status & Active Punch
  getTodayStatus: async () => {
    const { data } = await axios.get(`${BASE}/today`);
    return data;
  },

  // 4. Get Dashboard KPI Summary (Present, Avg Hours, Overtime, Short hours, Late marks)
  getMySummary: async (month, year) => {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    const { data } = await axios.get(`${BASE}/my-summary`, { params });
    return data;
  },

  // 5. Get Paginated Punch History Table
  getMyPunches: async ({ month, year, page = 1, limit = 50 } = {}) => {
    const params = { page, limit };
    if (month) params.month = month;
    if (year) params.year = year;
    const { data } = await axios.get(`${BASE}/my-punches`, { params });
    return data;
  },

  // 6. Multi-Month Trend Chart / History
  getMyMonthlyHistory: async (limit = 6) => {
    const { data } = await axios.get(`${BASE}/my-monthly-history`, {
      params: { limit },
    });
    return data;
  },

  // 7. Day-wise Calendar Status Pills (P, A, L, WO, H)
  getMyCalendar: async (month, year) => {
    const params = {};
    if (month) params.month = month;
    if (year) params.year = year;
    const { data } = await axios.get(`${BASE}/my-calendar`, { params });
    return data;
  },

  // 8. Delete Today's Punch (Mistake correction)
  deleteTodayPunch: async (punchId) => {
    const { data } = await axios.delete(`${BASE}/punches/${punchId}`);
    return data;
  },
};

export default attendanceApi;
