
import SuperAdmin_axios from "./SuperAdmin_axios";

const departmentApi = {
  getDepartments(params) {
    return SuperAdmin_axios.get("/super-admin/departments", { params });
  },

  getDepartmentById(departmentId) {
    return SuperAdmin_axios.get(
      `/super-admin/departments/${departmentId}`
    );
  },

  createDepartment(data) {
    return SuperAdmin_axios.post(
      "/super-admin/departments",
      data
    );
  },

  updateDepartment(departmentId, data) {
    return SuperAdmin_axios.put(
      `/super-admin/departments/${departmentId}`,
      data
    );
  },

  deleteDepartment(departmentId) {
    return SuperAdmin_axios.delete(
      `/super-admin/departments/${departmentId}`
    );
  },
};

export default departmentApi;
