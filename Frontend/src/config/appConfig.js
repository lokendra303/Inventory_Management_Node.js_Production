/**
 * API and static bases — set URLs in `.env` only.
 *
 * Switch local vs live: use the paired blocks in `.env` — comment one block,
 * uncomment the other (only one active line per variable name).
 *
 * REACT_APP_API_URL        — full base with /api (e.g. http://localhost:5000/api)
 * REACT_APP_SERVER_ORIGIN  — optional; origin for /uploads (no trailing slash)
 * REACT_APP_MOBILE_URL     — optional; base URL in barcode QR for /scan (phone must reach this host)
 * REACT_APP_LAN_API_URL    — optional; if REACT_APP_API_URL is unset and you open the SPA from a LAN IP, used as API base
 * REACT_APP_API_PORT       — fallback when API URL is inferred (default 5000)
 */

const DEFAULT_API_PORT = process.env.REACT_APP_API_PORT || '5000';

function stripTrailingSlash(s) {
  return (s || '').replace(/\/$/, '');
}

function currentHostname() {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
}

/**
 * Local dev: you can set REACT_APP_API_URL to `http://127.0.0.1:5000/api` to avoid IPv6 localhost issues.
 * If unset and hostname is localhost → 127.0.0.1:PORT/api; if you open from LAN IP, REACT_APP_LAN_API_URL is used when set.
 */
export function getApiBaseUrl() {
  const envUrl = stripTrailingSlash(process.env.REACT_APP_API_URL);
  if (envUrl) return envUrl;

  const host = currentHostname();
  if (host === 'localhost' || host === '127.0.0.1') {
    return `http://127.0.0.1:${DEFAULT_API_PORT}/api`;
  }

  const lan = stripTrailingSlash(process.env.REACT_APP_LAN_API_URL);
  if (lan) return lan;
  return `http://${host}:${DEFAULT_API_PORT}/api`;
}

export function getServerOrigin() {
  let explicit = stripTrailingSlash(process.env.REACT_APP_SERVER_ORIGIN);
  if (explicit) {
    explicit = explicit.replace(/\/api\/?$/i, '');
    return explicit;
  }
  const api = getApiBaseUrl();
  if (api.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  return stripTrailingSlash(api.replace(/\/api\/?$/i, ''));
}

/** Base URL embedded in mobile barcode QR (`{origin}/scan?sessionId=...`). */
export function getMobileScannerOrigin() {
  const url = stripTrailingSlash(process.env.REACT_APP_MOBILE_URL);
  if (url) return url;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return '';
}

/**
 * Absolute URL for /uploads/... paths.
 * Uses API base + path (e.g. https://host/api/uploads/...) so live nginx that only proxies /api still works.
 */
export function mediaUrl(path, { cacheBust = false } = {}) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  const q = cacheBust ? `?t=${Date.now()}` : '';
  if (p.startsWith('/uploads/')) {
    const api = stripTrailingSlash(getApiBaseUrl());
    if (api.startsWith('http')) {
      return `${api}${p}${q}`;
    }
    if (api.startsWith('/')) {
      return `${api}${p}${q}`;
    }
  }
  const base = getServerOrigin().replace(/\/$/, '');
  return `${base}${p}${q}`;
}

export const RAZORPAY_CHECKOUT_SCRIPT =
  process.env.REACT_APP_RAZORPAY_CHECKOUT_SCRIPT || 'https://checkout.razorpay.com/v1/checkout.js';
