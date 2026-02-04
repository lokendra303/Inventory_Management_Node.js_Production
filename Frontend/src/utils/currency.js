const currencies = {
  USD: { symbol: '$', name: 'US Dollar', rate: 1 },
  EUR: { symbol: '€', name: 'Euro', rate: 0.85 },
  GBP: { symbol: '£', name: 'British Pound', rate: 0.73 },
  INR: { symbol: '₹', name: 'Indian Rupee', rate: 83.50 },
  JPY: { symbol: '¥', name: 'Japanese Yen', rate: 110.25 },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', rate: 1.25 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', rate: 1.35 },
  CNY: { symbol: '¥', name: 'Chinese Yuan', rate: 6.45 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', rate: 1.35 },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', rate: 3.67 }
};

export const convertPrice = (amount, fromCurrency = 'USD', toCurrency = 'USD') => {
  if (!amount || fromCurrency === toCurrency) return parseFloat(amount) || 0;
  
  const fromRate = currencies[fromCurrency]?.rate || 1;
  const toRate = currencies[toCurrency]?.rate || 1;
  
  // Convert to USD first, then to target currency
  const usdAmount = parseFloat(amount) / fromRate;
  return usdAmount * toRate;
};

export const formatPrice = (amount, currency = 'USD', baseCurrency = 'USD') => {
  if (!amount && amount !== 0) return '-';
  
  const convertedAmount = convertPrice(amount, baseCurrency, currency);
  const currencyInfo = currencies[currency] || currencies.USD;
  
  return `${currencyInfo.symbol}${formatNumber(convertedAmount)}`;
};

export const getCurrencies = () => {
  return Object.keys(currencies).map(code => ({
    code,
    ...currencies[code]
  }));
};

export const getCurrencySymbol = (currency = 'USD') => {
  return currencies[currency]?.symbol || '$';
};

export const getCurrencyInfo = (currency = 'USD') => {
  return currencies[currency] || currencies.USD;
};

export const isValidCurrency = (currency) => {
  return currencies.hasOwnProperty(currency);
};

export const formatNumber = (value) => {
  if (!value && value !== 0) return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};