/**
 * API and static asset bases — use env in each environment instead of scattered literals.
 *
 * REACT_APP_API_URL        — full base with /api (e.g. http://localhost:5000/api)
 * REACT_APP_LAN_API_URL    — optional override when opening the SPA from LAN IP
 * REACT_APP_API_PORT       — fallback port for LAN / localhost (default 5000)
 * REACT_APP_SERVER_ORIGIN  — optional origin for /uploads only (e.g. https://api.example.com)
 * REACT_APP_RAZORPAY_CHECKOUT_SCRIPT — Razorpay checkout.js URL (default official CDN)
 * REACT_APP_OPENFOODFACTS_API_BASE — product API base (see utils/openFoodFacts.js)
 */

const DEFAULT_API_PORT = process.env.REACT_APP_API_PORT || '5000';
const ENV_PROFILE = (process.env.REACT_APP_ENV_PROFILE || '').trim().toUpperCase();

function getEnvByProfile(baseKey) {
  if (ENV_PROFILE) {
    const profileValue = process.env[`${baseKey}_${ENV_PROFILE}`];
    if (profileValue && profileValue.trim()) return profileValue;
  }
  return process.env[baseKey];
}

function currentHostname() {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
}

/**
 * Local dev: prefer relative `/api` so CRA's package.json proxy forwards to the backend.
 * Avoids Axios "Network Error" when `localhost` resolves to IPv6 but Node listens on IPv4 only.
 * Set REACT_APP_API_URL to force a full URL (e.g. direct to :5000 or another host).
 */
export function getApiBaseUrl() {
  const envUrl = getEnvByProfile('REACT_APP_API_URL');
  if (envUrl) return envUrl.replace(/\/$/, '');

  const host = currentHostname();
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://127.0.0.1:${DEFAULT_API_PORT}/api`;
  }

  const lan = getEnvByProfile('REACT_APP_LAN_API_URL');
  if (lan) return lan.replace(/\/$/, '');
  return `http://${host}:${DEFAULT_API_PORT}/api`;
}

export function getServerOrigin() {
  const explicit = (getEnvByProfile('REACT_APP_SERVER_ORIGIN') || '').replace(/\/$/, '');
  if (explicit) return explicit;
  const api = getApiBaseUrl();
  if (api.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  return api.replace(/\/api\/?$/, '');
}

/**
 * Absolute or same-origin URL for /uploads/... paths from the API.
 * In dev with relative `/api`, use root-relative `/uploads/...` so the CRA dev server
 * proxies to the same target as package.json "proxy" (localhost:5000). Cross-origin
 * http://127.0.0.1:5000 often breaks previews (cookies, mixed setups, IPv4/IPv6).
 */
export function mediaUrl(path, { cacheBust = false } = {}) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  const api = getApiBaseUrl();
  if (api.startsWith('/') && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return cacheBust ? `${p}?t=${Date.now()}` : p;
  }
  const base = getServerOrigin().replace(/\/$/, '');
  const q = cacheBust ? `?t=${Date.now()}` : '';
  return `${base}${p}${q}`;
}

export const RAZORPAY_CHECKOUT_SCRIPT =
  process.env.REACT_APP_RAZORPAY_CHECKOUT_SCRIPT || 'https://checkout.razorpay.com/v1/checkout.js';
