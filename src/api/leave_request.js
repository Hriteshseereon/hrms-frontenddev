import SuperAdmin_axios from "./SuperAdmin_axios";

const BASE = "/leave-requests";

const Employee_leaveRequest = {
  getReasonCategories: (params) =>
    SuperAdmin_axios.get(`${BASE}/reason-categories`, { params }),

  getTeamMembers: (params) =>
    SuperAdmin_axios.get(`${BASE}/team-members`, { params }),

  getLeaveTypes: (params) =>
    SuperAdmin_axios.get(`${BASE}/leave-types`, { params }),

  create: (formData, params) =>
    SuperAdmin_axios.post(BASE, formData, { params }),

  getAll: (params) =>
    SuperAdmin_axios.get(BASE, { params }),

  getById: (id, params) =>
    SuperAdmin_axios.get(`${BASE}/${id}`, { params }),
};

export default Employee_leaveRequest;