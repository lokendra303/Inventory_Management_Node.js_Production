/**
 * Exchange rate helpers for commercial documents (PO, SO, PI, SI).
 * Rate = institution base currency amount per 1 document currency unit.
 */

function isSameCurrency(a, b) {
  if (!a || !b) return true;
  return String(a).toUpperCase() === String(b).toUpperCase();
}

function isPlausibleCrossCurrencyRate(documentCcy, baseCcy, rate) {
  if (isSameCurrency(documentCcy, baseCcy)) {
    const r = Number(rate);
    return !Number.isFinite(r) || Math.abs(r - 1) < 1e-9;
  }
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return false;
  if (Math.abs(r - 1) < 1e-9) return false;
  return true;
}

function normalizeExchangeRateInput(rate, documentCcy, baseCcy) {
  if (isSameCurrency(documentCcy, baseCcy)) return 1;
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return null;
  return Math.round(r * 1e6) / 1e6;
}

function getExchangeRateValidationError(documentCcy, baseCcy, rate) {
  if (isSameCurrency(documentCcy, baseCcy)) return null;
  if (isPlausibleCrossCurrencyRate(documentCcy, baseCcy, rate)) return null;
  return `Invalid exchange rate for ${documentCcy} → ${baseCcy}. Set a live or saved rate; 1:1 is not allowed between different currencies.`;
}

/**
 * Resolve rate for save: use client value if valid, else try exchange_rates table.
 */
async function resolveExchangeRateForSave(db, institutionId, documentCcy, baseCcy, clientRate) {
  if (isSameCurrency(documentCcy, baseCcy)) return 1;

  const normalized = normalizeExchangeRateInput(clientRate, documentCcy, baseCcy);
  if (isPlausibleCrossCurrencyRate(documentCcy, baseCcy, normalized)) {
    return normalized;
  }

  const from = String(documentCcy).toUpperCase();
  const to = String(baseCcy).toUpperCase();

  const direct = await db.query(
    `SELECT rate FROM exchange_rates
     WHERE institution_id = ? AND from_currency = ? AND to_currency = ? LIMIT 1`,
    [institutionId, from, to]
  );
  if (direct?.length) {
    const r = normalizeExchangeRateInput(direct[0].rate, documentCcy, baseCcy);
    if (isPlausibleCrossCurrencyRate(documentCcy, baseCcy, r)) return r;
  }

  const inverse = await db.query(
    `SELECT rate FROM exchange_rates
     WHERE institution_id = ? AND from_currency = ? AND to_currency = ? LIMIT 1`,
    [institutionId, to, from]
  );
  if (inverse?.length) {
    const inv = Number(inverse[0].rate);
    if (Number.isFinite(inv) && inv > 0) {
      const r = normalizeExchangeRateInput(1 / inv, documentCcy, baseCcy);
      if (isPlausibleCrossCurrencyRate(documentCcy, baseCcy, r)) return r;
    }
  }

  return null;
}

async function getInstitutionBaseCurrency(db, institutionId) {
  const rows = await db.query(
    'SELECT COALESCE(base_currency, currency, \'USD\') AS base_currency FROM institutions WHERE id = ? LIMIT 1',
    [institutionId]
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row?.base_currency || 'USD';
}

module.exports = {
  isSameCurrency,
  isPlausibleCrossCurrencyRate,
  normalizeExchangeRateInput,
  getExchangeRateValidationError,
  resolveExchangeRateForSave,
  getInstitutionBaseCurrency,
};
