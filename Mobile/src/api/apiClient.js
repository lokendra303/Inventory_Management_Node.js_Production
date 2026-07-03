import axios from 'axios';
import { API_URL } from '../config/env';
import { getItem, KEYS } from './storage';

const GET_CACHE_MS = 5000;
const inflightGets = new Map();
const getCache = new Map();

function getCacheKey(url, config) {
  const params = config?.params ? JSON.stringify(config.params) : '';
  return `${url}?${params}`;
}

class ApiClient {
  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.api.interceptors.request.use(async (config) => {
      const token = await getItem(KEYS.token);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.institutionId) {
            config.headers['x-institution-id'] = payload.institutionId;
          }
        } catch {
          const institutionId = await getItem(KEYS.institutionId);
          if (institutionId) config.headers['x-institution-id'] = institutionId;
        }
      }
      return config;
    });
    this.api.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        const status = error.response?.status;
        if (status === 429 && error.config && !error.config.__rateLimitRetried) {
          error.config.__rateLimitRetried = true;
          const retryAfter = Number(error.response?.headers?.['retry-after']) || 2;
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          return this.api.request(error.config);
        }
        return Promise.reject(error);
      },
    );
  }

  setAuthToken(token) {
    if (token) this.api.defaults.headers.common.Authorization = `Bearer ${token}`;
    else delete this.api.defaults.headers.common.Authorization;
  }

  clearGetCache() {
    getCache.clear();
    inflightGets.clear();
  }

  async get(url, config = {}) {
    const bypassCache = config.cache === false;
    const key = getCacheKey(url, config);

    if (!bypassCache) {
      const cached = getCache.get(key);
      if (cached && Date.now() - cached.at < GET_CACHE_MS) {
        return cached.data;
      }
      if (inflightGets.has(key)) {
        return inflightGets.get(key);
      }
    }

    const request = this.api.get(url, config).then((data) => {
      if (!bypassCache) {
        getCache.set(key, { at: Date.now(), data });
      }
      inflightGets.delete(key);
      return data;
    }).catch((err) => {
      inflightGets.delete(key);
      throw err;
    });

    if (!bypassCache) inflightGets.set(key, request);
    return request;
  }

  post(url, data, config) {
    this.clearGetCache();
    return this.api.post(url, data, config);
  }

  put(url, data, config) {
    this.clearGetCache();
    return this.api.put(url, data, config);
  }

  delete(url, config) {
    this.clearGetCache();
    return this.api.delete(url, config);
  }
}

const apiClient = new ApiClient();
export default apiClient;
