
import axios from "axios";

const SuperAdmin_axios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

SuperAdmin_axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("super_admin_access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export default SuperAdmin_axios;
