
import axiosInstance from "./axios";

// Handle common FastAPI response formats.
const getList = (data) => {
  const result = data?.data ?? data?.items ?? data?.results ?? data;
  return Array.isArray(result) ? result : [];
};

const getRecord = (data) => data?.data ?? data?.result ?? data;

// MODULE APIs
export const getModules = async () => {
  const response = await axiosInstance.get("/modules");
  return getList(response.data);
};

export const getModule = async (moduleId) => {
  const response = await axiosInstance.get(`/modules/${moduleId}`);
  return getRecord(response.data);
};

export const createModule = async (payload) => {
  const response = await axiosInstance.post("/modules", payload);
  return getRecord(response.data);
};

export const updateModule = async (moduleId, payload) => {
  const response = await axiosInstance.put(
    `/modules/${moduleId}`,
    payload
  );
  return getRecord(response.data);
};

export const deleteModuleApi = async (moduleId) => {
  return axiosInstance.delete(`/modules/${moduleId}`);
};

// SUBMODULE APIs
export const getSubModules = async () => {
  const response = await axiosInstance.get("/submodules");
  return getList(response.data);
};

export const getSubModule = async (subModuleId) => {
  const response = await axiosInstance.get(
    `/submodules/${subModuleId}`
  );
  return getRecord(response.data);
};

export const createSubModule = async (payload) => {
  const response = await axiosInstance.post("/submodules", payload);
  return getRecord(response.data);
};

export const updateSubModule = async (subModuleId, payload) => {
  const response = await axiosInstance.put(
    `/submodules/${subModuleId}`,
    payload
  );
  return getRecord(response.data);
};

export const deleteSubModuleApi = async (subModuleId) => {
  return axiosInstance.delete(`/submodules/${subModuleId}`);
};
