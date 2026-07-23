import axios from "axios";
import { ACCESS_TOKEN } from "./constants";

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

export default api;
