import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../api";
import { REFRESH_TOKEN, ACCESS_TOKEN } from "../constants";
import { useState, useEffect } from "react";
import { isDesktop } from "../utils/desktop";

const ProtectedRoute = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    auth().catch(() => setIsAuthorized(false));
  }, []);

  // On desktop the JWT can outlive the sidecar (a fresh sidecar spawns each
  // launch), leaving a valid token but a locked vault. Gate on vault state so a
  // relaunch re-prompts for the password instead of entering half-locked with
  // unreadable secrets. The web build has no per-launch lock, so it's a no-op.
  const finishAuthorized = async () => {
    if (!isDesktop()) {
      setIsAuthorized(true);
      return;
    }
    try {
      const res = await api.get("/api/vault/state/");
      setIsAuthorized(res.data.unlocked === true);
    } catch {
      setIsAuthorized(false);
    }
  };

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN);
    try {
      const res = await api.post("/api/token/refresh/", {
        refresh: refreshToken,
      });
      if (res.status === 200) {
        localStorage.setItem(ACCESS_TOKEN, res.data.access);
        await finishAuthorized();
      } else {
        setIsAuthorized(false);
      }
    } catch (error) {
      console.log(error);
      setIsAuthorized(false);
    }
  };

  const auth = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setIsAuthorized(false);
      return;
    }
    const decoded = jwtDecode(token);
    const tokenExpiration = decoded.exp;
    const now = Date.now() / 1000;

    if (tokenExpiration < now) {
      await refreshToken();
    } else {
      await finishAuthorized();
    }
  };

  if (isAuthorized === null) {
    return <div>Loading...</div>;
  }

  return isAuthorized ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
