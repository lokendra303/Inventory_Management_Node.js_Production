/**
 * Shared pricing/totals/FX helpers for PO, SO, PI, SI and manual line entry.
 * Document amounts (lines + footer) are always in the selected document currency.
 * Institution base currency (from settings baseCurrency) is used for stock average cost.
 * exchangeRate = base-currency amount per 1 document-currency unit (e.g. 1 INR ≈ 0.012 USD).
 */

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function isSameCurrency(documentCcy, institutionCcy) {
  if (!documentCcy || !institutionCcy) return true;
  return String(documentCcy).toUpperCase() === String(institutionCcy).toUpperCase();
}

/** Institution amount per 1 document currency unit (e.g. INR→USD ≈ 0.012). Rejects bogus 1:1 across different currencies. */
export function isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, rate) {
  if (isSameCurrency(documentCcy, institutionCcy)) {
    const r = Number(rate);
    return !Number.isFinite(r) || Math.abs(r - 1) < 1e-9;
  }
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return false;
  if (Math.abs(r - 1) < 1e-9) return false;
  return true;
}

export function amountInDocumentCurrency(amountInst, documentCcy, institutionCcy, institutionPerDocument) {
  const n = Number(amountInst);
  if (!Number.isFinite(n)) return 0;
  if (isSameCurrency(documentCcy, institutionCcy)) return n;
  const r = Number(institutionPerDocument);
  if (!isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, r)) return null;
  return roundMoney(n / r);
}

export function averageCostInDocumentCurrency(costInst, documentCcy, institutionCcy, institutionPerDocument) {
  if (costInst == null || costInst === '') return null;
  const c = Number(costInst);
  if (!Number.isFinite(c) || c <= 0) return null;
  if (isSameCurrency(documentCcy, institutionCcy)) return c;
  const r = Number(institutionPerDocument);
  if (!isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, r)) return null;
  return roundMoney(c / r);
}

export function convertDocumentAmountToInstitution(amount, documentCcy, institutionCcy, rate) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (isSameCurrency(documentCcy, institutionCcy)) return roundMoney(n);
  if (!isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, rate)) return null;
  return roundMoney(n * Number(rate));
}

export function getExchangeRateValidationError(documentCcy, institutionCcy, rate) {
  if (isSameCurrency(documentCcy, institutionCcy)) return null;
  if (isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, rate)) return null;
  return `Set a valid exchange rate between ${documentCcy} and ${institutionCcy} (use Refresh live rate, saved rates in Settings, or enter manually). A 1:1 rate is not valid for different currencies.`;
}

/** Sum line amounts; grand = round(sub) − round(disc) + round(tax). */
export function calculateCommercialTotals(lines, options = {}) {
  const {
    getQuantity = (l) => Number(l?.quantity) || 0,
    getUnitAmount = (l) => Number(l?.unitPrice ?? l?.unitCost) || 0,
    getDiscountRate = (l) => Number(l?.discountRate) || 0,
    getTaxRate = (l) => Number(l?.taxRate) || 0,
  } = options;

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;

  (lines || []).forEach((line) => {
    const qty = getQuantity(line);
    const unit = getUnitAmount(line);
    const disc = getDiscountRate(line);
    const tax = getTaxRate(line);
    const lineTotal = qty * unit;
    const discountAmount = (lineTotal * disc) / 100;
    const taxableAmount = lineTotal - discountAmount;
    const taxAmount = (taxableAmount * tax) / 100;
    subtotal += lineTotal;
    totalDiscount += discountAmount;
    totalTax += taxAmount;
  });

  const subR = roundMoney(subtotal);
  const discR = roundMoney(totalDiscount);
  const taxR = roundMoney(totalTax);
  const grandTotal = roundMoney(subR - discR + taxR);

  return { subtotal: subR, totalDiscount: discR, totalTax: taxR, grandTotal };
}

export async function fetchLiveExchangeRate(apiService, fromCcy, toCcy) {
  if (!fromCcy || !toCcy || isSameCurrency(fromCcy, toCcy)) return 1;
  const res = await apiService.get('/settings/exchange-rates/live', {
    params: { base: fromCcy, to: toCcy },
  });
  if (!res?.success || res.data?.rate == null) {
    throw new Error(res?.error || 'Could not load live exchange rate');
  }
  const r = parseFloat(res.data.rate);
  if (!Number.isFinite(r) || r <= 0) throw new Error('Invalid live exchange rate');
  const rounded = Math.round(r * 1e6) / 1e6;
  if (!isPlausibleCrossCurrencyRate(fromCcy, toCcy, rounded)) {
    throw new Error('Invalid live exchange rate');
  }
  return rounded;
}

/** Institution units per 1 document unit from Settings → Exchange rates table. */
export async function fetchStoredExchangeRate(apiService, documentCcy, institutionCcy) {
  if (isSameCurrency(documentCcy, institutionCcy)) return 1;
  const res = await apiService.get('/settings/exchange-rates');
  if (!res?.success || !Array.isArray(res.data)) return null;

  const from = String(documentCcy).toUpperCase();
  const to = String(institutionCcy).toUpperCase();

  const direct = res.data.find(
    (row) =>
      String(row.from_currency || '').toUpperCase() === from &&
      String(row.to_currency || '').toUpperCase() === to
  );
  if (direct?.rate != null) {
    const r = parseFloat(direct.rate);
    if (isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, r)) return Math.round(r * 1e6) / 1e6;
  }

  const inverse = res.data.find(
    (row) =>
      String(row.from_currency || '').toUpperCase() === to &&
      String(row.to_currency || '').toUpperCase() === from
  );
  if (inverse?.rate != null) {
    const inv = parseFloat(inverse.rate);
    if (Number.isFinite(inv) && inv > 0) {
      const r = Math.round((1 / inv) * 1e6) / 1e6;
      if (isPlausibleCrossCurrencyRate(documentCcy, institutionCcy, r)) return r;
    }
  }

  return null;
}

/**
 * Resolve institution-per-document rate: live API first, then saved institution rates.
 * @returns {{ rate: number|null, source: 'same_currency'|'live'|'stored'|'missing' }}
 */
export async function resolveExchangeRate(apiService, documentCcy, institutionCcy) {
  if (isSameCurrency(documentCcy, institutionCcy)) {
    return { rate: 1, source: 'same_currency' };
  }

  try {
    const live = await fetchLiveExchangeRate(apiService, documentCcy, institutionCcy);
    return { rate: live, source: 'live' };
  } catch {
    /* try stored */
  }

  try {
    const stored = await fetchStoredExchangeRate(apiService, documentCcy, institutionCcy);
    if (stored != null) return { rate: stored, source: 'stored' };
  } catch {
    /* missing */
  }

  return { rate: null, source: 'missing' };
}

export async function convertAmountBetweenCurrencies(apiService, amount, fromCcy, toCcy) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return 0;
  if (isSameCurrency(fromCcy, toCcy)) return roundMoney(n);
  const { rate } = await resolveExchangeRate(apiService, fromCcy, toCcy);
  if (rate == null) throw new Error(`No exchange rate available for ${fromCcy} → ${toCcy}`);
  return roundMoney(n * rate);
}
