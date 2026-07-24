import axios from "axios";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "./constants";

const api = axios.create({
  // Relative URLs when the app is served by Django itself (desktop build);
  // the dev/web build reads VITE_API_URL from .env.
  baseURL: import.meta.env.VITE_API_URL || "",
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// An expired access token surfaces as a 401 on whatever request happens to run
// next. Transparently refresh once and replay the request so an in-session
// expiry never bubbles up as a spurious error. Concurrent 401s (the dashboard
// fires several calls at once) share a single in-flight refresh so we don't
// stampede /api/token/refresh/. If the refresh token is also dead, clear the
// session and bounce to the login/account picker.
let refreshPromise = null;

const refreshAccessToken = async () => {
  const refresh = localStorage.getItem(REFRESH_TOKEN);
  if (!refresh) throw new Error("no refresh token");
  // Bare axios so this call skips the interceptors below (no auth header, no
  // recursive 401 handling).
  const res = await axios.post(
    `${api.defaults.baseURL}/api/token/refresh/`,
    { refresh }
  );
  localStorage.setItem(ACCESS_TOKEN, res.data.access);
  return res.data.access;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Only handle a first 401 on a normal request; never retry the refresh
    // call itself (that would loop).
    if (status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      localStorage.removeItem(ACCESS_TOKEN);
      localStorage.removeItem(REFRESH_TOKEN);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
