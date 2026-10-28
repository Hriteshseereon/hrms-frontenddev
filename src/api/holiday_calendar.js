import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/attendance/holiday-calendars";

// Scope IDs (organization_id, company_id, branch_id) go in `params` (query string), never in the body.
const SuperAdmin_holidayCalendar = {
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
  create: (payload, params) => SuperAdmin_axios.post(BASE, payload, { params }),
  update: (id, payload, params) => SuperAdmin_axios.put(`${BASE}/${id}`, payload, { params }),
  patch: (id, payload, params) => SuperAdmin_axios.patch(`${BASE}/${id}`, payload, { params }),
  remove: (id, params) => SuperAdmin_axios.delete(`${BASE}/${id}`, { params }),
  // multipart/form-data (CSV file)
  createWithFile: (formData, params) =>
    SuperAdmin_axios.post(`${BASE}/upload`, formData, { params }),
  updateWithFile: (id, formData, params) =>
    SuperAdmin_axios.put(`${BASE}/${id}/upload`, formData, { params }),
};

export default SuperAdmin_holidayCalendar;