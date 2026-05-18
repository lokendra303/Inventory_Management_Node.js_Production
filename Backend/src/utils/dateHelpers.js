/**
 * Normalize API date input (ISO string or Date from Joi) to YYYY-MM-DD for MySQL DATE columns.
 */
function normalizeDateInput(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallback;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, 10);
  }
  return fallback;
}

module.exports = { normalizeDateInput };
