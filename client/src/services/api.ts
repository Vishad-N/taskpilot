import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const activeOrganizationId = window.localStorage.getItem("taskpilot.activeOrganizationId");

    if (activeOrganizationId) {
      config.headers = config.headers ?? {};
      config.headers["x-organization-id"] = activeOrganizationId;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      const requestUrl = String(error?.config?.url ?? "");
      const isPublicAuthRequest =
        requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

      if (!isPublicAuthRequest) {
        window.localStorage.removeItem("token");
        window.localStorage.removeItem("taskpilot.activeOrganizationId");

        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
