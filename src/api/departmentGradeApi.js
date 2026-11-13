import SuperAdmin_axios from "./SuperAdmin_axios";

// Master Data → Organisation → Department Grade. Company / branch scope is added by the axios scope interceptor.
const BASE = "/department-grades";

const departmentGradeApi = {
  list: (params) => SuperAdmin_axios.get(BASE, { params }),
  get: (id) => SuperAdmin_axios.get(`${BASE}/${encodeURIComponent(id)}`),
  create: (data) => SuperAdmin_axios.post(BASE, data),
  update: (id, data) => SuperAdmin_axios.put(`${BASE}/${encodeURIComponent(id)}`, data),
  remove: (id) => SuperAdmin_axios.delete(`${BASE}/${encodeURIComponent(id)}`),
};

export default departmentGradeApi;
