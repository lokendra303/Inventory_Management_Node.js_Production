/**
 * Shared pricing/totals/FX helpers for PO, SO, PI, SI and manual line entry.
 * Document amounts (lines + footer) are always in the selected document currency.
 * Institution/base currency is used for stock average cost; convert with exchangeRate
 * where exchangeRate = institution amount per 1 document currency unit.
 */

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function amountInDocumentCurrency(amountInst, documentCcy, institutionCcy, institutionPerDocument) {
  const n = Number(amountInst);
  if (!Number.isFinite(n)) return 0;
  if (!documentCcy || !institutionCcy || documentCcy === institutionCcy) return n;
  const r = Number(institutionPerDocument);
  if (!Number.isFinite(r) || r <= 0) return n;
  return roundMoney(n / r);
}

export function averageCostInDocumentCurrency(costInst, documentCcy, institutionCcy, institutionPerDocument) {
  if (costInst == null || costInst === '') return null;
  const c = Number(costInst);
  if (!Number.isFinite(c) || c <= 0) return null;
  if (!documentCcy || !institutionCcy || documentCcy === institutionCcy) return c;
  const r = Number(institutionPerDocument);
  if (!Number.isFinite(r) || r <= 0) return c;
  return roundMoney(c / r);
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
  if (!fromCcy || !toCcy || fromCcy === toCcy) return 1;
  const res = await apiService.get('/settings/exchange-rates/live', {
    params: { base: fromCcy, to: toCcy },
  });
  if (!res?.success || res.data?.rate == null) {
    throw new Error(res?.error || 'Could not load live exchange rate');
  }
  const r = parseFloat(res.data.rate);
  if (!Number.isFinite(r) || r <= 0) throw new Error('Invalid live exchange rate');
  return Math.round(r * 1e6) / 1e6;
}

export async function convertAmountBetweenCurrencies(apiService, amount, fromCcy, toCcy) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return 0;
  if (!fromCcy || !toCcy || fromCcy === toCcy) return roundMoney(n);
  const rate = await fetchLiveExchangeRate(apiService, fromCcy, toCcy);
  return roundMoney(n * rate);
}
