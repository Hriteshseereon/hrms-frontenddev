import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/attendance/workday-configurations";

// Scope IDs (organization_id, company_id, branch_id) go in `params` (query string), never in the body.
// Body: { working_rules: { monday: [b,b,b,b,b], ..., sunday: [b,b,b,b,b] } }
const SuperAdmin_workdayConfiguration = {
  // GET    /attendance/workday-configurations
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
  // GET    /attendance/workday-configurations/{configuration_id}
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
  // POST   /attendance/workday-configurations  (upsert for the scope)
  create: (payload, params) => SuperAdmin_axios.post(BASE, payload, { params }),
  // PUT    /attendance/workday-configurations/{configuration_id}
  update: (id, payload, params) => SuperAdmin_axios.put(`${BASE}/${id}`, payload, { params }),
  // PATCH  /attendance/workday-configurations/{configuration_id}
  patch: (id, payload, params) => SuperAdmin_axios.patch(`${BASE}/${id}`, payload, { params }),
  // DELETE /attendance/workday-configurations/{configuration_id}
  remove: (id, params) => SuperAdmin_axios.delete(`${BASE}/${id}`, { params }),
};

export default SuperAdmin_workdayConfiguration;