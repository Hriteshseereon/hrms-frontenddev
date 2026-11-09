import axios from "./SuperAdmin_axios";

const BASE = "/attendance";

/** Drops empty filters so the backend only sees the ones the admin actually set. */
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== "all"),
  );

/** Admin "Employee Attendance" (all employees in scope): GET /attendance/employee-attendance/* */
export const employeeAttendanceApi = {
  daily: async (params) => {
    const { data } = await axios.get(`${BASE}/employee-attendance/daily`, { params: clean(params) });
    return data;
  },
  weekly: async (params) => {
    const { data } = await axios.get(`${BASE}/employee-attendance/weekly`, { params: clean(params) });
    return data;
  },
  monthly: async (params) => {
    const { data } = await axios.get(`${BASE}/employee-attendance/monthly`, { params: clean(params) });
    return data;
  },
  summary: async (params) => {
    const { data } = await axios.get(`${BASE}/employee-attendance/summary`, { params: clean(params) });
    return data;
  },
  employee: async (employeeId, params) => {
    const { data } = await axios.get(`${BASE}/employee-attendance/employees/${employeeId}`, {
      params: clean(params),
    });
    return data;
  },
};

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

  // 9. Biometric devices for the "Biometric device" marking mode
  getDevices: async () => {
    const { data } = await axios.get(`${BASE}/devices`);
    return data;
  },

  // 10. Missed punch-out regularisation requests (employee side)
  createRegularisation: async (body) => {
    const { data } = await axios.post(`${BASE}/regularisation-requests`, body);
    return data;
  },
  getMyRegularisations: async (params = {}) => {
    const { data } = await axios.get(`${BASE}/regularisation-requests/mine`, { params });
    return data;
  },
  withdrawRegularisation: async (id) => {
    const { data } = await axios.delete(`${BASE}/regularisation-requests/${id}`);
    return data;
  },

  // 11. Approver queue (reporting managers, HR / admin)
  getRegularisationQueue: async (params = {}) => {
    const { data } = await axios.get(`${BASE}/regularisation-requests`, { params });
    return data;
  },
  decideRegularisation: async (id, body) => {
    const { data } = await axios.post(`${BASE}/regularisation-requests/${id}/decision`, body);
    return data;
  },

  // 12. HR direct correction
  listPunches: async (params = {}) => {
    const { data } = await axios.get(`${BASE}/punches`, { params });
    return data;
  },
  addPunch: async (body) => {
    const { data } = await axios.post(`${BASE}/punches`, body);
    return data;
  },
  regularisePunch: async (id, body) => {
    const { data } = await axios.post(`${BASE}/punches/${id}/regularise`, body);
    return data;
  },

  // Payroll attendance review — reads the persisted monthly register and lock state.
  getPayrollSummary: async (month) => {
    const { data } = await axios.get(`${BASE}/report`, { params: { month } });
    return data;
  },
  /** GET /attendance/report with the screen filters (dept, office, shift, empId, band, sort, companyId). */
  getReport: async (params) => {
    const { data } = await axios.get(`${BASE}/report`, { params: clean(params) });
    return data;
  },
  getPayrollRegister: async (month) => {
    const { data } = await axios.get(`${BASE}/register`, {
      params: { month, view: "month" },
    });
    return data;
  },
  getPayrollWorkHours: async (month) => {
    // A string is the month alone (lock panel); an object carries the screen filters too.
    const params = typeof month === "string" ? { month } : clean(month);
    const { data } = await axios.get(`${BASE}/work-hours`, { params });
    return data;
  },
  getLocks: async (companyId) => {
    const { data } = await axios.get(`${BASE}/locks`, {
      params: companyId ? { companyId } : {},
    });
    return data;
  },
  lockPayrollMonth: async (period, companyId) => {
    const { data } = await axios.post(`${BASE}/locks`, { period, companyId });
    return data;
  },
  unlockPayrollMonth: async (period, companyId) => {
    const { data } = await axios.delete(`${BASE}/locks/${encodeURIComponent(period)}`, {
      params: companyId ? { companyId } : {},
    });
    return data;
  },

  // 8. Delete Today's Punch (Mistake correction)
  deleteTodayPunch: async (punchId) => {
    const { data } = await axios.delete(`${BASE}/punches/${punchId}`);
    return data;
  },
};

export default attendanceApi;
