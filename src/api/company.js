import SuperAdmin_axios from "./SuperAdmin_axios";

const Company_api = {
  // Get all companies
  async getCompanies() {
    try {
      return await SuperAdmin_axios.get("/super-admin/companies");
    } catch (err) {
      if (err?.response?.status === 404 || err?.response?.status === 403) {
        return await SuperAdmin_axios.get("/companies");
      }
      throw err;
    }
  },

  // Get single company by ID
  getCompany(companyId) {
    return SuperAdmin_axios.get(`/super-admin/companies/${companyId}`);
  },

  // Create a company (with statutory details, documents & enabled modules)
  createCompany(data) {
    return SuperAdmin_axios.post("/super-admin/companies", data);
  },

  // Update company details & sync modules
  updateCompany(companyId, data) {
    return SuperAdmin_axios.put(`/super-admin/companies/${companyId}`, data);
  },

  // Super Admin only: issue a new temporary password for the company admin (shown once).
  resetAdminPassword(companyId) {
    return SuperAdmin_axios.post(`/super-admin/companies/${companyId}/admin/reset-password`);
  },

  // Modules of a company: { core, optional, available_optional } — core is always on, optional is the editable set.
  getCompanyModules(companyId) {
    return SuperAdmin_axios.get(`/companies/${companyId}/modules`);
  },

  // Replaces the optional set: { modules: ["performance", ...] }. Core keys are never sent.
  updateCompanyModules(companyId, modules) {
    return SuperAdmin_axios.put(`/companies/${companyId}/modules`, { modules });
  },

  // Organisation dashboard (cards per company) and aggregate reports. Super Admin only, no X-Company-Id.
  getOrgDashboard() {
    return SuperAdmin_axios.get("/org/dashboard");
  },

  // Delete company (fails if employees are assigned)
  deleteCompany(companyId) {
    return SuperAdmin_axios.delete(`/super-admin/companies/${companyId}`);
  },
};

export default Company_api;