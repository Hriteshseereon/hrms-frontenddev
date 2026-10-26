// about_company.js — Master Data › Recruitment › About Company (Super Admin)
import SuperAdmin_axios from "./SuperAdmin_axios";

// If your VITE_API_BASE_URL does NOT already end with /api/v1, change this to
// "/api/v1/recruitment/about-company".
const BASE = "/recruitment/about-company";

// Scope IDs are query parameters only (never in the body).
const scopeParams = (organizationId) =>
  organizationId ? { organization_id: organizationId } : {};

const SuperAdmin_aboutCompany = {
  // GET /recruitment/about-company
  // Returns the saved record, or null when nothing has been saved yet (404).
  async get(organizationId) {
    try {
      const res = await SuperAdmin_axios.get(BASE, {
        params: scopeParams(organizationId),
      });
      const data = res.data;
      if (!data || typeof data !== "object") return null;
      return data.data && !Array.isArray(data.data) ? data.data : data;
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  },

  // POST /recruitment/about-company  (create or update)
  // UI field "size" is sent as "company_size".
  async save(organizationId, { mission, size, industry }) {
    const res = await SuperAdmin_axios.post(
      BASE,
      {
        mission: String(mission ?? "").trim(),
        company_size: String(size ?? "").trim(),
        industry: String(industry ?? "").trim(),
      },
      { params: scopeParams(organizationId) },
    );
    return res.data;
  },
};

export default SuperAdmin_aboutCompany;