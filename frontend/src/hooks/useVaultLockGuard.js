import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { onApiActivity } from "../api";
import { ACCESS_TOKEN } from "../constants";
import { isDesktop } from "../utils/desktop";

// Fallback idle window if the server doesn't report one (mirrors the backend
// default in api/vault.py). Refined from /api/vault/state/ on the first check.
const FALLBACK_IDLE_MS = 15 * 60 * 1000;
// Fire the client check a hair after the server's window so a still-quiet
// session is already locked server-side by the time we ask (no revive race).
const IDLE_CHECK_BUFFER_MS = 3000;

// The desktop vault drops its in-memory DEK after an idle window (backend
// api/vault.py), so a session left sitting — most often with the window in the
// background — silently re-locks: the JWT stays valid but encrypted secrets can
// no longer be decrypted. ProtectedRoute only checks vault state when a route
// mounts, so an in-session re-lock goes unnoticed and the user is stuck with
// broken credentials. This guard re-checks the authoritative vault state when
// the user returns to the app (focus / tab visible) and once the idle window
// has elapsed with no activity, then sends them to the account picker to
// re-enter their password. The web build has no per-session lock — no-op there.
export default function useVaultLockGuard() {
  const navigate = useNavigate();
  const idleMsRef = useRef(FALLBACK_IDLE_MS);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isDesktop()) return undefined;

    let cancelled = false;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const checkNow = async () => {
      if (cancelled) return;
      // Already logged out (e.g. the token interceptor bounced us): nothing to
      // guard, and the check would 401 anyway.
      if (!localStorage.getItem(ACCESS_TOKEN)) return;
      try {
        const res = await api.get("/api/vault/state/");
        if (cancelled) return;
        const timeout = Number(res.data.idle_timeout);
        if (Number.isFinite(timeout) && timeout > 0) {
          idleMsRef.current = timeout * 1000;
        }
        if (res.data.unlocked === false) {
          clearTimer();
          navigate("/login", { replace: true });
        } else {
          schedule();
        }
      } catch {
        // Network blip or a refresh in flight — don't evict on a flaky request;
        // the next activity or focus event re-checks.
      }
    };

    const schedule = () => {
      clearTimer();
      timerRef.current = setTimeout(
        checkNow,
        idleMsRef.current + IDLE_CHECK_BUFFER_MS
      );
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") checkNow();
    };

    // Each authenticated response refreshes the server idle clock, so treat it
    // as activity and push our check back the same amount — keeping client and
    // server in lockstep so the timer only fires on a genuinely idle session.
    const unsubscribe = onApiActivity(schedule);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    schedule();

    return () => {
      cancelled = true;
      clearTimer();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [navigate]);
}
