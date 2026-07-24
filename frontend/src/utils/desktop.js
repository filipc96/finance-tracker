// True when running as the packaged Tauri desktop app rather than the web
// build. The desktop build is served by the Django sidecar at a same-origin
// relative baseURL (no VITE_API_URL), and Tauri injects a global. Either signal
// is sufficient; VITE_API_URL being empty is the reliable build-time one.
export function isDesktop() {
  if (typeof window !== "undefined" && window.__TAURI__) return true;
  return !import.meta.env.VITE_API_URL;
}
