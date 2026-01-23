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

class CurrencyService {
  static convertPrice(amount, fromCurrency = 'USD', toCurrency = 'USD') {
    if (!amount || fromCurrency === toCurrency) return amount;
    
    const fromRate = currencies[fromCurrency]?.rate || 1;
    const toRate = currencies[toCurrency]?.rate || 1;
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  }
  
  static formatPrice(amount, currency = 'USD', baseCurrency = 'USD') {
    if (!amount && amount !== 0) return '-';
    
    const convertedAmount = this.convertPrice(amount, baseCurrency, currency);
    const currencyInfo = currencies[currency] || currencies.USD;
    
    const formattedAmount = parseFloat(convertedAmount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${currencyInfo.symbol}${formattedAmount}`;
  }
  
  static getCurrencies() {
    return Object.keys(currencies).map(code => ({
      code,
      ...currencies[code]
    }));
  }
  
  static getCurrencySymbol(currency = 'USD') {
    return currencies[currency]?.symbol || '$';
  }
}

module.exports = CurrencyService;