

import SuperAdmin_axios from "@/api/SuperAdmin_axios";

const awardMasterApi = {
  // GET: Fetch all awards
  list: async () => {
    const response = await SuperAdmin_axios.get("/awards");
    return response.data;
  },

  // GET: Fetch one award by ID
  getById: async (awardId) => {
    const response = await SuperAdmin_axios.get(
      `/awards/${awardId}`
    );
    return response.data;
  },

  // POST: Create an award
  create: async (payload) => {
    const response = await SuperAdmin_axios.post("/awards", {
      name: payload.name,
      description: payload.description || "",
    });
    return response.data;
  },

  // PUT: Update the complete award
  update: async (awardId, payload) => {
    const response = await SuperAdmin_axios.put(
      `/awards/${awardId}`,
      {
        name: payload.name,
        description: payload.description || "",
      }
    );
    return response.data;
  },

  // PATCH: Partially update an award
  patch: async (awardId, payload) => {
    const response = await SuperAdmin_axios.patch(
      `/awards/${awardId}`,
      payload
    );
    return response.data;
  },

  // DELETE: Delete an award
  remove: async (awardId) => {
    const response = await SuperAdmin_axios.delete(
      `/awards/${awardId}`
    );
    return response.data;
  },
};

// Important: export the default object used by MastersView.jsx
export default awardMasterApi;
