
import SuperAdmin_axios from "./SuperAdmin_axios";

const Branch_api = {
  // GET: List branches, optionally filtered by company
  getBranches(companyId = null) {
    return SuperAdmin_axios.get("/super-admin/branches", {
      params: companyId ? { company_id: companyId } : {},
    });
  },

  // POST: Create a branch under a company
  createBranch(data) {
    return SuperAdmin_axios.post("/super-admin/branches", data);
  },
};

export default Branch_api;
