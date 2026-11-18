import SuperAdmin_axios from "./SuperAdmin_axios";

const MANAGER_BASE = "/leave-approvals";
const HR_BASE = "/hr-leave-approvals";

// Approver views of leave requests (the logged-in user is identified by the token; no scope params are sent).
//  - Manager step:    /leave-approvals      (first approval; 403/empty for people who are not managers)
//  - HR Manager step: /hr-leave-approvals   (second approval of requests the manager already approved;
//                                            403 "Only an HR Manager can open this list" for everyone else)
const make = (base) => ({
  // GET {base}?status=&search=&employee_id=&leave_type=&page=&page_size=
  getAll: (params) => SuperAdmin_axios.get(base, { params }),

  // POST {base}/{leave_request_id}/approve   body: { remarks }
  approve: (id, payload) => SuperAdmin_axios.post(`${base}/${encodeURIComponent(id)}/approve`, payload),

  // POST {base}/{leave_request_id}/reject    body: { remarks }
  reject: (id, payload) => SuperAdmin_axios.post(`${base}/${encodeURIComponent(id)}/reject`, payload),
});

export const Leave_approval_manager = make(MANAGER_BASE);
export const Leave_approval_hr = make(HR_BASE);

const Leave_approval = Leave_approval_manager;
export default Leave_approval;
