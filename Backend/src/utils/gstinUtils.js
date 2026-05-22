/**
 * Normalize optional GSTIN for storage (uppercase, trimmed; empty -> null).
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function normalizeGstin(value) {
  const v = String(value ?? '').trim().toUpperCase();
  return v || null;
}

/** Normalize optional PAN for storage (uppercase, trimmed; empty -> null). */
function normalizePan(value) {
  const v = String(value ?? '').trim().toUpperCase();
  return v || null;
}

module.exports = { normalizeGstin, normalizePan };
