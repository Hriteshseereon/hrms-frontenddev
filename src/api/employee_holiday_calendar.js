// src/api/employee_holiday_calendar.js
// Employee portal — read-only access to the holiday calendars created in Super Admin.
// Uses the same axios instance as meApi.js, so the logged-in employee's token is sent.
import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/attendance/holiday-calendars";

const Employee_holidayCalendar = {
  // GET /attendance/holiday-calendars — scope comes from the employee's token;
  // optional query params: organization_id, company_id, branch_id, page, page_size
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
};

export default Employee_holidayCalendar;