import axios from 'axios';

const TOKEN_KEY = 'platformAdminToken';

const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  }
  return process.env.REACT_APP_LAN_API_URL || `http://${hostname}:5000/api`;
};

const platformApi = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

platformApi.interceptors.response.use(
  (res) => (res.config.responseType === 'blob' ? res : res.data),
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/platform/auth/login')) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.location.href = '/platform/login';
    }
    return Promise.reject(error);
  }
);

export const platformToken = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export default platformApi;
