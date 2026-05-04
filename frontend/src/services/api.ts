const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestError = new Error(data?.error?.message || "Request failed.") as Error & { status?: number };
    requestError.status = response.status;
    throw requestError;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, {}, token),
  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body || {}) }, token),
  patch: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body || {}) }, token),
  put: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body || {}) }, token),
  upload: <T>(path: string, body: FormData, token?: string) =>
    request<T>(path, { method: "POST", body }, token),
  uploadPut: <T>(path: string, body: FormData, token?: string) =>
    request<T>(path, { method: "PUT", body }, token),
  delete: <T>(path: string, token?: string) => request<T>(path, { method: "DELETE" }, token),
};
