import SuperAdmin_axios from "./SuperAdmin_axios";

// Master Data → Organisation → Department
// Company / branch scope is attached by the axios scope interceptor.
const BASE = "/departments";

const departmentApi = {
  // GET /departments
  getDepartments(params) {
    return SuperAdmin_axios.get(BASE, { params });
  },

  // GET /departments/{department_id}
  getDepartmentById(departmentId) {
    return SuperAdmin_axios.get(`${BASE}/${encodeURIComponent(departmentId)}`);
  },

  // POST /departments
  // { grade_id, category_id, department_code, department_name, section_code_id, section_name_id }
  createDepartment(data) {
    return SuperAdmin_axios.post(BASE, data);
  },

  // PUT /departments/{department_id}  (same body as create)
  updateDepartment(departmentId, data) {
    return SuperAdmin_axios.put(`${BASE}/${encodeURIComponent(departmentId)}`, data);
  },

  // POST /departments/import  (multipart, field "file" = .xlsx)
  // Columns: Department Grade, Category, Section Name, Section Code, Department Name, Department Code.
  // All-or-nothing: if any row is invalid, nothing is created and all errors come back (422).
  // organization_id / company_id / branch_id are optional query params (scope interceptor adds them).
  importDepartments(file, params) {
    const formData = new FormData();
    formData.append("file", file);
    return SuperAdmin_axios.post(`${BASE}/import`, formData, { params });
  },

  // DELETE /departments/{department_id}
  deleteDepartment(departmentId) {
    return SuperAdmin_axios.delete(`${BASE}/${encodeURIComponent(departmentId)}`);
  },
};

export default departmentApi;
