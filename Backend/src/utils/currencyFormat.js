/**
 * Format amounts in document currency (no FX conversion).
 * Matches Frontend/src/utils/currency.js symbols for PDFs and API responses.
 */

const CURRENCY_SYMBOLS = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF ',
  AED: 'د.إ',
  SAR: 'ر.س',
  SGD: 'S$',
  HKD: 'HK$',
  NZD: 'NZ$',
  ZAR: 'R',
  BRL: 'R$',
  MXN: 'MX$',
  KRW: '₩',
  THB: '฿',
  MYR: 'RM',
  PHP: '₱',
  IDR: 'Rp',
  PKR: 'Rs',
  BDT: '৳',
  LKR: 'Rs',
  NPR: 'Rs',
  VND: '₫',
  TRY: '₺',
  RUB: '₽',
  PLN: 'zł',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  ILS: '₪',
};

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.00';
  return num.toFixed(2);
}

/**
 * @param {number|string} amount - already in document currency
 * @param {string} [currencyCode]
 * @returns {string}
 */
/** PDF-safe symbols (Helvetica lacks some Unicode currency glyphs). */
const PDF_CURRENCY_SYMBOLS = {
  ...CURRENCY_SYMBOLS,
  INR: 'Rs.',
};

function formatDocumentAmount(amount, currencyCode = 'USD', options = {}) {
  const code = String(currencyCode || 'USD').toUpperCase().trim();
  const formatted = formatNumber(amount);
  const map = options.pdf ? PDF_CURRENCY_SYMBOLS : CURRENCY_SYMBOLS;
  const sym = map[code];
  if (sym) return `${sym}${formatted}`;
  return `${code} ${formatted}`;
}

function getCurrencySymbol(currencyCode = 'USD') {
  const code = String(currencyCode || 'USD').toUpperCase().trim();
  return CURRENCY_SYMBOLS[code] || code;
}

/** Short label for PDF table headers, e.g. Rate (INR), Rate ($). */
function getRateColumnHeader(currencyCode = 'USD') {
  const code = String(currencyCode || 'USD').toUpperCase().trim();
  const headerSymbols = { USD: '$', GBP: '£', JPY: '¥', CNY: '¥', EUR: 'EUR' };
  const label = headerSymbols[code] || code;
  return `Rate (${label})`;
}

module.exports = {
  formatDocumentAmount,
  getCurrencySymbol,
  getRateColumnHeader,
  formatNumber,
};
