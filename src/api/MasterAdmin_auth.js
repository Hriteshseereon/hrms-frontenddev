
import axiosInstance from "./axios";

// Save tokens returned by the backend
const saveTokens = (data) => {
  if (data.access_token) {
    localStorage.setItem(
      "access_token",
      data.access_token
    );
  }

  if (data.refresh_token) {
    localStorage.setItem(
      "refresh_token",
      data.refresh_token
    );
  }
};

// MASTER ADMIN REGISTRATION
export const registerMasterAdmin = async (payload) => {
  const response = await axiosInstance.post(
    "/auth/master-admins/register",
    payload
  );

  return response.data;
};

// MASTER ADMIN LOGIN
export const loginMasterAdmin = async (credentials) => {
  const response = await axiosInstance.post(
    "/auth/master-admins/login",
    credentials
  );

  saveTokens(response.data);

  return response.data;
};

// GET CURRENTLY LOGGED-IN USER
export const getCurrentUser = async () => {
  const response = await axiosInstance.get(
    "/auth/me"
  );

  return response.data;
};

// REFRESH TOKENS
export const refreshTokens = async (refreshToken) => {
  const response = await axiosInstance.post(
    "/auth/refresh",
    {
      refresh_token: refreshToken,
    }
  );

  saveTokens(response.data);

  return response.data;
};

// LOGOUT
export const logoutMasterAdmin = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};
