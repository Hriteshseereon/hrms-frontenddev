import SuperAdmin_axios from "./SuperAdmin_axios";

/**
 * File & Document Upload API
 * Handles company logos, statutory documents (GST, PAN, CIN), and organisation branding.
 */
export const uploadApi = {
  // 1. Generic Super Admin Upload (saves to S3 / storage and returns public URL)
  uploadFile: async (file, folder = "companies") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await SuperAdmin_axios.post("/super-admin/upload", formData);
    const data = response.data?.data ?? response.data;
    return data?.url || data;
  },

  // 2. Direct Organisation Logo Upload
  uploadOrgLogo: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await SuperAdmin_axios.post("/organisation/upload-logo", formData);
    const data = response.data?.data ?? response.data;
    return data?.url || data;
  },
};

export default uploadApi;
