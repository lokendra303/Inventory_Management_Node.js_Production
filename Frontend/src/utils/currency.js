// Full 166-currency list matching open.er-api.com
const currencies = {
  AED: { symbol: 'د.إ', name: 'UAE Dirham',                  rate: 3.6725 },
  AFN: { symbol: '؋',   name: 'Afghan Afghani',               rate: 64.41 },
  ALL: { symbol: 'L',   name: 'Albanian Lek',                 rate: 81.26 },
  AMD: { symbol: '֏',   name: 'Armenian Dram',                rate: 374.31 },
  ANG: { symbol: 'ƒ',   name: 'Netherlands Antillean Guilder',rate: 1.79 },
  AOA: { symbol: 'Kz',  name: 'Angolan Kwanza',               rate: 912.0 },
  ARS: { symbol: '$',   name: 'Argentine Peso',               rate: 1065.0 },
  AUD: { symbol: 'A$',  name: 'Australian Dollar',            rate: 1.56 },
  AWG: { symbol: 'ƒ',   name: 'Aruban Florin',                rate: 1.79 },
  AZN: { symbol: '₼',   name: 'Azerbaijani Manat',            rate: 1.70 },
  BAM: { symbol: 'KM',  name: 'Bosnia-Herzegovina Mark',      rate: 1.66 },
  BBD: { symbol: 'Bds$',name: 'Barbadian Dollar',             rate: 2.0 },
  BDT: { symbol: '৳',   name: 'Bangladeshi Taka',             rate: 110.0 },
  BGN: { symbol: 'лв',  name: 'Bulgarian Lev',                rate: 1.66 },
  BHD: { symbol: '.د.ب',name: 'Bahraini Dinar',               rate: 0.376 },
  BIF: { symbol: 'Fr',  name: 'Burundian Franc',              rate: 2900.0 },
  BMD: { symbol: '$',   name: 'Bermudian Dollar',             rate: 1.0 },
  BND: { symbol: 'B$',  name: 'Brunei Dollar',                rate: 1.34 },
  BOB: { symbol: 'Bs.', name: 'Bolivian Boliviano',           rate: 6.91 },
  BRL: { symbol: 'R$',  name: 'Brazilian Real',               rate: 5.70 },
  BSD: { symbol: 'B$',  name: 'Bahamian Dollar',              rate: 1.0 },
  BTN: { symbol: 'Nu',  name: 'Bhutanese Ngultrum',           rate: 83.5 },
  BWP: { symbol: 'P',   name: 'Botswanan Pula',               rate: 13.6 },
  BYN: { symbol: 'Br',  name: 'Belarusian Ruble',             rate: 3.27 },
  BZD: { symbol: 'BZ$', name: 'Belize Dollar',                rate: 2.0 },
  CAD: { symbol: 'C$',  name: 'Canadian Dollar',              rate: 1.38 },
  CDF: { symbol: 'Fr',  name: 'Congolese Franc',              rate: 2800.0 },
  CHF: { symbol: 'Fr',  name: 'Swiss Franc',                  rate: 0.90 },
  CLP: { symbol: '$',   name: 'Chilean Peso',                 rate: 940.0 },
  CNY: { symbol: '¥',   name: 'Chinese Yuan',                 rate: 7.25 },
  COP: { symbol: '$',   name: 'Colombian Peso',               rate: 4200.0 },
  CRC: { symbol: '₡',   name: 'Costa Rican Colón',            rate: 520.0 },
  CUP: { symbol: '$',   name: 'Cuban Peso',                   rate: 24.0 },
  CVE: { symbol: '$',   name: 'Cape Verdean Escudo',          rate: 93.5 },
  CZK: { symbol: 'Kč',  name: 'Czech Koruna',                 rate: 22.5 },
  DJF: { symbol: 'Fr',  name: 'Djiboutian Franc',             rate: 177.7 },
  DKK: { symbol: 'kr',  name: 'Danish Krone',                 rate: 6.33 },
  DOP: { symbol: 'RD$', name: 'Dominican Peso',               rate: 59.0 },
  DZD: { symbol: 'د.ج', name: 'Algerian Dinar',               rate: 134.0 },
  EGP: { symbol: '£',   name: 'Egyptian Pound',               rate: 49.0 },
  ERN: { symbol: 'Nfk', name: 'Eritrean Nakfa',               rate: 15.0 },
  ETB: { symbol: 'Br',  name: 'Ethiopian Birr',               rate: 57.0 },
  EUR: { symbol: '€',   name: 'Euro',                         rate: 0.849 },
  FJD: { symbol: 'FJ$', name: 'Fijian Dollar',                rate: 2.25 },
  FKP: { symbol: '£',   name: 'Falkland Islands Pound',       rate: 0.739 },
  FOK: { symbol: 'kr',  name: 'Faroese Króna',                rate: 6.33 },
  GBP: { symbol: '£',   name: 'British Pound',                rate: 0.739 },
  GEL: { symbol: '₾',   name: 'Georgian Lari',                rate: 2.73 },
  GGP: { symbol: '£',   name: 'Guernsey Pound',               rate: 0.739 },
  GHS: { symbol: '₵',   name: 'Ghanaian Cedi',                rate: 15.5 },
  GIP: { symbol: '£',   name: 'Gibraltar Pound',              rate: 0.739 },
  GMD: { symbol: 'D',   name: 'Gambian Dalasi',               rate: 68.0 },
  GNF: { symbol: 'Fr',  name: 'Guinean Franc',                rate: 8600.0 },
  GTQ: { symbol: 'Q',   name: 'Guatemalan Quetzal',           rate: 7.75 },
  GYD: { symbol: '$',   name: 'Guyanese Dollar',              rate: 209.0 },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar',             rate: 7.78 },
  HNL: { symbol: 'L',   name: 'Honduran Lempira',             rate: 24.7 },
  HRK: { symbol: 'kn',  name: 'Croatian Kuna',                rate: 6.40 },
  HTG: { symbol: 'G',   name: 'Haitian Gourde',               rate: 132.0 },
  HUF: { symbol: 'Ft',  name: 'Hungarian Forint',             rate: 355.0 },
  IDR: { symbol: 'Rp',  name: 'Indonesian Rupiah',            rate: 16300.0 },
  ILS: { symbol: '₪',   name: 'Israeli New Shekel',           rate: 3.65 },
  IMP: { symbol: '£',   name: 'Isle of Man Pound',            rate: 0.739 },
  INR: { symbol: '₹',   name: 'Indian Rupee',                 rate: 93.25 },
  IQD: { symbol: 'ع.د', name: 'Iraqi Dinar',                  rate: 1310.0 },
  IRR: { symbol: '﷼',   name: 'Iranian Rial',                 rate: 42000.0 },
  ISK: { symbol: 'kr',  name: 'Icelandic Króna',              rate: 138.0 },
  JEP: { symbol: '£',   name: 'Jersey Pound',                 rate: 0.739 },
  JMD: { symbol: 'J$',  name: 'Jamaican Dollar',              rate: 157.0 },
  JOD: { symbol: 'JD',  name: 'Jordanian Dinar',              rate: 0.709 },
  JPY: { symbol: '¥',   name: 'Japanese Yen',                 rate: 154.0 },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling',              rate: 129.0 },
  KGS: { symbol: 'с',   name: 'Kyrgyzstani Som',              rate: 86.5 },
  KHR: { symbol: '៛',   name: 'Cambodian Riel',               rate: 4050.0 },
  KID: { symbol: '$',   name: 'Kiribati Dollar',              rate: 1.56 },
  KMF: { symbol: 'Fr',  name: 'Comorian Franc',               rate: 416.0 },
  KRW: { symbol: '₩',   name: 'South Korean Won',             rate: 1380.0 },
  KWD: { symbol: 'KD',  name: 'Kuwaiti Dinar',                rate: 0.307 },
  KYD: { symbol: '$',   name: 'Cayman Islands Dollar',        rate: 0.833 },
  KZT: { symbol: '₸',   name: 'Kazakhstani Tenge',            rate: 470.0 },
  LAK: { symbol: '₭',   name: 'Laotian Kip',                  rate: 21800.0 },
  LBP: { symbol: 'ل.ل', name: 'Lebanese Pound',               rate: 89500.0 },
  LKR: { symbol: 'Rs',  name: 'Sri Lankan Rupee',             rate: 298.0 },
  LRD: { symbol: '$',   name: 'Liberian Dollar',              rate: 194.0 },
  LSL: { symbol: 'L',   name: 'Lesotho Loti',                 rate: 18.3 },
  LYD: { symbol: 'ل.د', name: 'Libyan Dinar',                 rate: 4.85 },
  MAD: { symbol: 'MAD', name: 'Moroccan Dirham',              rate: 9.95 },
  MDL: { symbol: 'L',   name: 'Moldovan Leu',                 rate: 17.5 },
  MGA: { symbol: 'Ar',  name: 'Malagasy Ariary',              rate: 4500.0 },
  MKD: { symbol: 'ден', name: 'Macedonian Denar',             rate: 52.3 },
  MMK: { symbol: 'K',   name: 'Myanmar Kyat',                 rate: 2100.0 },
  MNT: { symbol: '₮',   name: 'Mongolian Tögrög',             rate: 3400.0 },
  MOP: { symbol: 'P',   name: 'Macanese Pataca',              rate: 8.05 },
  MRU: { symbol: 'UM',  name: 'Mauritanian Ouguiya',          rate: 39.5 },
  MUR: { symbol: 'Rs',  name: 'Mauritian Rupee',              rate: 45.5 },
  MVR: { symbol: 'Rf',  name: 'Maldivian Rufiyaa',            rate: 15.4 },
  MWK: { symbol: 'MK',  name: 'Malawian Kwacha',              rate: 1730.0 },
  MXN: { symbol: '$',   name: 'Mexican Peso',                 rate: 17.2 },
  MYR: { symbol: 'RM',  name: 'Malaysian Ringgit',            rate: 4.42 },
  MZN: { symbol: 'MT',  name: 'Mozambican Metical',           rate: 63.8 },
  NAD: { symbol: '$',   name: 'Namibian Dollar',              rate: 18.3 },
  NGN: { symbol: '₦',   name: 'Nigerian Naira',               rate: 1580.0 },
  NIO: { symbol: 'C$',  name: 'Nicaraguan Córdoba',           rate: 36.7 },
  NOK: { symbol: 'kr',  name: 'Norwegian Krone',              rate: 10.6 },
  NPR: { symbol: 'Rs',  name: 'Nepalese Rupee',               rate: 133.5 },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar',           rate: 1.70 },
  OMR: { symbol: 'ر.ع.',name: 'Omani Rial',                   rate: 0.385 },
  PAB: { symbol: 'B/.',  name: 'Panamanian Balboa',           rate: 1.0 },
  PEN: { symbol: 'S/.',  name: 'Peruvian Sol',                rate: 3.72 },
  PGK: { symbol: 'K',   name: 'Papua New Guinean Kina',       rate: 3.95 },
  PHP: { symbol: '₱',   name: 'Philippine Peso',              rate: 56.5 },
  PKR: { symbol: 'Rs',  name: 'Pakistani Rupee',              rate: 279.0 },
  PLN: { symbol: 'zł',  name: 'Polish Złoty',                 rate: 3.82 },
  PYG: { symbol: '₲',   name: 'Paraguayan Guaraní',           rate: 7600.0 },
  QAR: { symbol: 'ر.ق', name: 'Qatari Riyal',                 rate: 3.64 },
  RON: { symbol: 'lei', name: 'Romanian Leu',                 rate: 4.22 },
  RSD: { symbol: 'din', name: 'Serbian Dinar',                rate: 99.5 },
  RUB: { symbol: '₽',   name: 'Russian Ruble',                rate: 90.0 },
  RWF: { symbol: 'Fr',  name: 'Rwandan Franc',                rate: 1310.0 },
  SAR: { symbol: 'ر.س', name: 'Saudi Riyal',                  rate: 3.75 },
  SBD: { symbol: 'SI$', name: 'Solomon Islands Dollar',       rate: 8.45 },
  SCR: { symbol: 'Rs',  name: 'Seychellois Rupee',            rate: 14.2 },
  SDG: { symbol: '£',   name: 'Sudanese Pound',               rate: 601.0 },
  SEK: { symbol: 'kr',  name: 'Swedish Krona',                rate: 10.3 },
  SGD: { symbol: 'S$',  name: 'Singapore Dollar',             rate: 1.34 },
  SHP: { symbol: '£',   name: 'Saint Helena Pound',           rate: 0.739 },
  SLE: { symbol: 'Le',  name: 'Sierra Leonean Leone',         rate: 22.5 },
  SLL: { symbol: 'Le',  name: 'Sierra Leonean Leone (old)',   rate: 22500.0 },
  SOS: { symbol: 'Sh',  name: 'Somali Shilling',              rate: 571.0 },
  SRD: { symbol: '$',   name: 'Surinamese Dollar',            rate: 36.5 },
  SSP: { symbol: '£',   name: 'South Sudanese Pound',         rate: 1300.0 },
  STN: { symbol: 'Db',  name: 'São Tomé & Príncipe Dobra',    rate: 20.8 },
  SYP: { symbol: '£',   name: 'Syrian Pound',                 rate: 13000.0 },
  SZL: { symbol: 'L',   name: 'Swazi Lilangeni',              rate: 18.3 },
  THB: { symbol: '฿',   name: 'Thai Baht',                    rate: 34.5 },
  TJS: { symbol: 'SM',  name: 'Tajikistani Somoni',           rate: 10.9 },
  TMT: { symbol: 'T',   name: 'Turkmenistani Manat',          rate: 3.50 },
  TND: { symbol: 'د.ت', name: 'Tunisian Dinar',               rate: 3.10 },
  TOP: { symbol: 'T$',  name: 'Tongan Paʻanga',               rate: 2.35 },
  TRY: { symbol: '₺',   name: 'Turkish Lira',                 rate: 38.5 },
  TTD: { symbol: 'TT$', name: 'Trinidad & Tobago Dollar',     rate: 6.79 },
  TVD: { symbol: '$',   name: 'Tuvaluan Dollar',              rate: 1.56 },
  TWD: { symbol: 'NT$', name: 'New Taiwan Dollar',            rate: 32.5 },
  TZS: { symbol: 'Sh',  name: 'Tanzanian Shilling',           rate: 2650.0 },
  UAH: { symbol: '₴',   name: 'Ukrainian Hryvnia',            rate: 41.5 },
  UGX: { symbol: 'Sh',  name: 'Ugandan Shilling',             rate: 3700.0 },
  USD: { symbol: '$',   name: 'US Dollar',                    rate: 1.0 },
  UYU: { symbol: '$',   name: 'Uruguayan Peso',               rate: 42.5 },
  UZS: { symbol: 'so\'m',name: 'Uzbekistani Som',             rate: 12800.0 },
  VES: { symbol: 'Bs.F',name: 'Venezuelan Bolívar',           rate: 36.5 },
  VND: { symbol: '₫',   name: 'Vietnamese Đồng',              rate: 25400.0 },
  VUV: { symbol: 'Vt',  name: 'Vanuatu Vatu',                 rate: 119.0 },
  WST: { symbol: 'T',   name: 'Samoan Tālā',                  rate: 2.75 },
  XAF: { symbol: 'Fr',  name: 'Central African CFA Franc',    rate: 557.0 },
  XCD: { symbol: '$',   name: 'East Caribbean Dollar',        rate: 2.70 },
  XDR: { symbol: 'SDR', name: 'IMF Special Drawing Rights',   rate: 0.757 },
  XOF: { symbol: 'Fr',  name: 'West African CFA Franc',       rate: 557.0 },
  XPF: { symbol: 'Fr',  name: 'CFP Franc',                    rate: 101.3 },
  YER: { symbol: '﷼',   name: 'Yemeni Rial',                  rate: 250.0 },
  ZAR: { symbol: 'R',   name: 'South African Rand',           rate: 18.3 },
  ZMW: { symbol: 'ZK',  name: 'Zambian Kwacha',               rate: 27.5 },
  ZWL: { symbol: '$',   name: 'Zimbabwean Dollar',            rate: 322.0 },
};

export const convertPrice = (amount, fromCurrency = 'USD', toCurrency = 'USD') => {
  if (!amount || fromCurrency === toCurrency) return parseFloat(amount) || 0;
  const fromRate = currencies[fromCurrency]?.rate || 1;
  const toRate   = currencies[toCurrency]?.rate   || 1;
  const usdAmount = parseFloat(amount) / fromRate;
  return usdAmount * toRate;
};

export const formatPrice = (amount, currency = 'USD', baseCurrency = 'USD') => {
  if (!amount && amount !== 0) return '-';
  const convertedAmount = convertPrice(amount, baseCurrency, currency);
  const currencyInfo = currencies[currency] || currencies.USD;
  return `${currencyInfo.symbol}${formatNumber(convertedAmount)}`;
};

export const getCurrencies = () =>
  Object.keys(currencies)
    .sort()
    .map(code => ({ code, ...currencies[code] }));

export const getCurrencySymbol = (currency = 'USD') =>
  currencies[currency]?.symbol || currency;

export const getCurrencyInfo = (currency = 'USD') =>
  currencies[currency] || currencies.USD;

export const isValidCurrency = (currency) =>
  Object.prototype.hasOwnProperty.call(currencies, currency);

export const formatNumber = (value) => {
  if (!value && value !== 0) return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};

/** Format an amount already in the given currency (no base/display conversion). */
export const formatDocumentAmount = (amount, currencyCode = 'USD', showSymbol = true) => {
  if (amount == null || (amount !== 0 && !amount)) return '-';
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  const formatted = formatNumber(num);
  return showSymbol ? `${getCurrencySymbol(currencyCode)}${formatted}` : formatted;
};
