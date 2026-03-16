import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const ACCESS_TOKEN_KEY = "land_registry_access_token";

let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
let refreshPromise = null;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true
});

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || "";
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

async function requestTokenRefresh() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const isAuthRoute = original.url?.includes("/auth/");

    if (status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        await requestTokenRefresh();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${getAccessToken()}`;
        return api(original);
      } catch (_refreshError) {
        setAccessToken("");
      }
    }

    throw error;
  }
);

export async function signup(payload) {
  const { data } = await api.post("/auth/signup", payload);
  setAccessToken(data.accessToken);
  return data;
}

export async function login(payload) {
  const { data } = await api.post("/auth/login", payload);
  setAccessToken(data.accessToken);
  return data;
}

export async function refreshSession() {
  const data = await requestTokenRefresh();
  return data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    setAccessToken("");
  }
}

export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function fetchProperties() {
  const { data } = await api.get("/properties");
  return data;
}

export async function registerProperty(payload) {
  const { data } = await api.post("/properties/register", payload);
  return data;
}

export async function transferProperty(chainId, newOwner) {
  const { data } = await api.post(`/properties/${chainId}/transfer`, { newOwner });
  return data;
}

export async function verifyProperty(chainId) {
  const { data } = await api.post(`/properties/${chainId}/verify`);
  return data;
}

export async function approveProperty(chainId, level, approved = true) {
  const { data } = await api.post(`/properties/${chainId}/approvals/${level}`, { approved });
  return data;
}

export async function fetchTimeline(chainId) {
  const { data } = await api.get(`/properties/${chainId}/timeline`);
  return data;
}

export async function fetchGasComparison() {
  const { data } = await api.get("/properties/gas/compare");
  return data;
}

export async function fetchParcelBySurveyNumber(surveyNumber) {
  const { data } = await api.get(`/parcels/${encodeURIComponent(surveyNumber)}`);
  return data;
}

export async function fetchSystemPreflight() {
  const { data } = await api.get("/system/preflight");
  return data;
}
