/**
 * Helpers for showing audit request/response data as flat field → value rows.
 */

export function formatAuditLeafValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    return val.length > 4000 ? `${val.slice(0, 4000)}…` : val;
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

/** Flatten nested objects/arrays into rows with dot/bracket paths */
export function flattenAuditPayload(obj, prefix = '', depth = 0, maxDepth = 12) {
  const rows = [];
  if (depth > maxDepth) {
    rows.push({ key: prefix || '…', value: '[Nested data truncated — see Raw JSON]' });
    return rows;
  }
  if (obj === null || obj === undefined) {
    rows.push({ key: prefix || '(root)', value: '—' });
    return rows;
  }
  if (typeof obj !== 'object') {
    rows.push({ key: prefix || '(root)', value: formatAuditLeafValue(obj) });
    return rows;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      rows.push({ key: prefix || '[]', value: '(empty list)' });
      return rows;
    }
    obj.forEach((item, i) => {
      const path = prefix ? `${prefix}[${i}]` : `[${i}]`;
      if (item !== null && typeof item === 'object') {
        rows.push(...flattenAuditPayload(item, path, depth + 1, maxDepth));
      } else {
        rows.push({ key: path, value: formatAuditLeafValue(item) });
      }
    });
    return rows;
  }
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    rows.push({ key: prefix || '{}', value: '(empty)' });
    return rows;
  }
  for (const k of keys) {
    const path = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object') {
      rows.push(...flattenAuditPayload(v, path, depth + 1, maxDepth));
    } else {
      rows.push({ key: path, value: formatAuditLeafValue(v) });
    }
  }
  return rows;
}

/** Parse API values that may still be JSON strings */
export function parseAuditObject(maybe) {
  if (maybe === null || maybe === undefined) return null;
  if (typeof maybe === 'string') {
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }
  return maybe;
}
