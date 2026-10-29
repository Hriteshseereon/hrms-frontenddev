import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/attendance/workday-configurations";

// Scope IDs (organization_id, company_id, branch_id) go in `params` (query string), never in the body.
const SuperAdmin_workdayConfiguration = {
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
  create: (payload, params) => SuperAdmin_axios.post(BASE, payload, { params }),
  update: (id, payload, params) => SuperAdmin_axios.put(`${BASE}/${id}`, payload, { params }),
  patch: (id, payload, params) => SuperAdmin_axios.patch(`${BASE}/${id}`, payload, { params }),
};

export default SuperAdmin_workdayConfiguration;