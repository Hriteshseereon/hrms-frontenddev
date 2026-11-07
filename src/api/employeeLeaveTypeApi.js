import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/leave-types";

const employeeLeaveTypeApi = {
  // GET /api/v1/leave-types?active=true&page=1&page_size=100
  // Reads leave types created in Super Admin.
  getAll: async (params = {}) => {
    const { data } = await SuperAdmin_axios.get(BASE, {
      params: {
        active: true,
        page: 1,
        page_size: 100,
        ...params,
      },
    });

    return data;
  },
};

export default employeeLeaveTypeApi;