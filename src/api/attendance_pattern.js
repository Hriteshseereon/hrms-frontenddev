import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/attendance/patterns";
const TIMESHEET_BASE = "/attendance-and-time/timesheet-formats";

// Scope IDs (organization_id, company_id, branch_id) go in `params` (query string), never in the body.
const SuperAdmin_attendancePattern = {
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
  create: (payload, params) => SuperAdmin_axios.post(BASE, payload, { params }),
  update: (id, payload, params) => SuperAdmin_axios.put(`${BASE}/${id}`, payload, { params }),
  patch: (id, payload, params) => SuperAdmin_axios.patch(`${BASE}/${id}`, payload, { params }),
  remove: (id, params) => SuperAdmin_axios.delete(`${BASE}/${id}`, { params }),

  // Timesheet Formats master
  getTimesheetFormats: (params) => SuperAdmin_axios.get(TIMESHEET_BASE, { params }),
  getTimesheetFormatById: (id, params) =>
    SuperAdmin_axios.get(`${TIMESHEET_BASE}/${id}`, { params }),
  createTimesheetFormat: (payload, params) =>
    SuperAdmin_axios.post(TIMESHEET_BASE, payload, { params }),
  updateTimesheetFormat: (id, payload, params) =>
    SuperAdmin_axios.put(`${TIMESHEET_BASE}/${id}`, payload, { params }),
  patchTimesheetFormat: (id, payload, params) =>
    SuperAdmin_axios.patch(`${TIMESHEET_BASE}/${id}`, payload, { params }),
  removeTimesheetFormat: (id, params) =>
    SuperAdmin_axios.delete(`${TIMESHEET_BASE}/${id}`, { params }),
};

export default SuperAdmin_attendancePattern;