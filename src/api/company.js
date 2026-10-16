import SuperAdmin_axios from "./SuperAdmin_axios";

const Company_api = {
  // Get companies
  getCompanies() {
    return SuperAdmin_axios.get("/super-admin/companies");
  },

  // Create a company
  createCompany(data) {
    return SuperAdmin_axios.post("/super-admin/companies", data);
  },
};

export default Company_api;