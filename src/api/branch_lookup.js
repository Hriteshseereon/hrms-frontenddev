import SuperAdmin_axios from "./SuperAdmin_axios";

const SuperAdmin_branchLookup = {
  getAll: (params) => SuperAdmin_axios.get("/super-admin/branches", { params }),
};

export default SuperAdmin_branchLookup;