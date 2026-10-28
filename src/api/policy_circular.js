import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/documents/policies-circulars";

// Scope IDs (organization_id, company_id, branch_id) go in `params` (query string).
const SuperAdmin_policyCircular = {
  getCategories: (params) => SuperAdmin_axios.get(`${BASE}/categories`, { params }),
  getAll: (params) => SuperAdmin_axios.get(BASE, { params }),
  getById: (id, params) => SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
  // multipart/form-data (FormData). Do not set Content-Type; the browser adds the boundary.
  create: (formData, params) => SuperAdmin_axios.post(BASE, formData, { params }),
  update: (id, formData, params) => SuperAdmin_axios.put(`${BASE}/${id}`, formData, { params }),
  remove: (id, params) => SuperAdmin_axios.delete(`${BASE}/${id}`, { params }),
  download: (id, params) =>
    SuperAdmin_axios.get(`${BASE}/${id}/download`, { params, responseType: "blob" }),
};

export default SuperAdmin_policyCircular;