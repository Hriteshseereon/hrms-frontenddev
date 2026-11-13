import SuperAdmin_axios from "./SuperAdmin_axios";

// Master Data → Organisation → Department Section
// Company / branch scope is attached by the axios scope interceptor.
const BASE = "/department-sections";

const departmentSectionApi = {
  // GET /department-sections
  list: (params) => SuperAdmin_axios.get(BASE, { params }),

  // GET /department-sections/{section_id}
  get: (id) => SuperAdmin_axios.get(`${BASE}/${encodeURIComponent(id)}`),

  // POST /department-sections  { section_name, section_code }
  create: (data) => SuperAdmin_axios.post(BASE, data),

  // PUT /department-sections/{section_id}  { section_name, section_code }
  update: (id, data) => SuperAdmin_axios.put(`${BASE}/${encodeURIComponent(id)}`, data),

  // DELETE /department-sections/{section_id}
  remove: (id) => SuperAdmin_axios.delete(`${BASE}/${encodeURIComponent(id)}`),
};

export default departmentSectionApi;
