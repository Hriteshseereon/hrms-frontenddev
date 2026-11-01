import SuperAdmin_axios from "./SuperAdmin_axios";
import { uploadApi } from "./uploadApi";
import { theOrganisation, updateTenant } from "@/features/organization/data/tenancy";

export const organizationApi = {
  // 1. Get current Root Organisation details
  getOrganization: async () => {
    try {
      const res = await SuperAdmin_axios.get("/organisation");
      return res.data?.data ?? res.data;
    } catch {
      // Fallback to local tenant store if backend endpoint is not yet migrated
      return theOrganisation();
    }
  },

  // 2. Setup / Update Organisation Profile (PUT /organisation or POST fallback)
  saveOrganization: async (payload) => {
    try {
      let res;
      try {
        res = await SuperAdmin_axios.put("/organisation", payload);
      } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 405) {
          res = await SuperAdmin_axios.post("/organisation/setup", payload);
        } else {
          throw err;
        }
      }
      const data = res.data?.data ?? res.data;
      if (data?.id) {
        updateTenant(data.id, data);
      }
      return data;
    } catch (err) {
      // Fallback to updating local store so frontend immediately reflects the user's input
      const current = theOrganisation();
      if (current) {
        updateTenant(current.id, payload);
      }
      return payload;
    }
  },

  // 3. Direct Logo Upload
  uploadLogo: async (file) => {
    return uploadApi.uploadOrgLogo(file);
  },
};

export default organizationApi;
