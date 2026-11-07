import axios from "./SuperAdmin_axios";

const BASE = "/attendance/employee-attendance";

/** Fetch the authenticated user's permitted employee attendance register for one date. */
export async function getAllEmployeeAttendanceDaily(date) {
  const { data } = await axios.get(`${BASE}/daily`, { params: { date } });
  return data;
}

/** Fetch the permitted employee attendance register for a date range no longer than one week. */
export async function getAllEmployeeAttendanceWeekly(startDate, endDate) {
  const { data } = await axios.get(`${BASE}/weekly`, {
    params: { start_date: startDate, end_date: endDate },
  });
  return data;
}

/** Fetch the permitted employee attendance register for one calendar month. */
export async function getAllEmployeeAttendanceMonthly(month, year) {
  const { data } = await axios.get(`${BASE}/monthly`, { params: { month, year } });
  return data;
}

/** Fetch attendance totals and per-employee summary for the requested view/date range. */
export async function getAllEmployeeAttendanceSummary(params = {}) {
  const { data } = await axios.get(`${BASE}/summary`, { params });
  return data;
}

/** Fetch one employee's full attendance, daily statuses, and punches for review. */
export async function getAllEmployeeAttendanceById(employeeId) {
  const { data } = await axios.get(`${BASE}/employees/${encodeURIComponent(employeeId)}`);
  return data;
}

export default {
  getAllEmployeeAttendanceDaily,
  getAllEmployeeAttendanceWeekly,
  getAllEmployeeAttendanceMonthly,
  getAllEmployeeAttendanceSummary,
  getAllEmployeeAttendanceById,
};
