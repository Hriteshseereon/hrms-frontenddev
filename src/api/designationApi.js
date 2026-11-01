
import SuperAdmin_axios from "./SuperAdmin_axios";

const designationApi = {
  getDesignations(params) {
    return SuperAdmin_axios.get("/super-admin/designations", { params });
  },

  getDesignationById(designationId) {
    return SuperAdmin_axios.get(
      `/super-admin/designations/${designationId}`
    );
  },

  createDesignation(data) {
    return SuperAdmin_axios.post(
      "/super-admin/designations",
      data
    );
  },

  updateDesignation(designationId, data) {
    return SuperAdmin_axios.put(
      `/super-admin/designations/${designationId}`,
      data
    );
  },

  deleteDesignation(designationId) {
    return SuperAdmin_axios.delete(
      `/super-admin/designations/${designationId}`
    );
  },
};

export default designationApi;
