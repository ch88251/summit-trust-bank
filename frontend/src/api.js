const BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "stb_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function errorMessage(data, fallback) {
  if (!data?.detail) return fallback;
  if (typeof data.detail === "string") return data.detail;
  // FastAPI validation errors: [{loc, msg}, ...]
  return data.detail.map((e) => `${e.loc?.at(-1) ?? "field"}: ${e.msg}`).join("; ");
}

export async function api(path, { method = "GET", body } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && token && path !== "/auth/login") {
    tokenStore.clear();
    window.dispatchEvent(new Event("auth:expired"));
  }
  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(errorMessage(data, res.statusText || "Request failed"), res.status);
  }
  return res.status === 204 ? null : res.json();
}
