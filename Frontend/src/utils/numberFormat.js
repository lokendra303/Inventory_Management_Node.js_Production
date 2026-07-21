// Format number to remove unnecessary decimals
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '0';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  
  // If it's a whole number, return without decimals
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // Otherwise, format with specified decimals and remove trailing zeros
  return parseFloat(num.toFixed(decimals)).toString();
};

/** Ant Design InputNumber formatter — hides trailing zeros (58 not 58.00). */
export function formatNumberInput(value, decimals = 4) {
  if (value === '' || value === undefined || value === null) return '';
  const n = Number(value);
  return Number.isFinite(n) ? formatNumber(n, decimals) : String(value);
}

/** Ant Design InputNumber parser — digits and decimal only. */
export function parseNumberInput(value) {
  return String(value ?? '').replace(/[^\d.-]/g, '');
}

/** Shared props for clean numeric inputs without forced .00 padding. */
export function cleanNumberInputProps(decimals = 2) {
  return {
    formatter: (value) => formatNumberInput(value, decimals),
    parser: parseNumberInput,
  };
}

// Format quantity (typically whole numbers)
export const formatQuantity = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  
  // If it's a whole number, return as is
  if (Number.isInteger(num)) {
    return num.toString();
  }
  
  // For fractional quantities, show up to 2 decimals without trailing zeros
  return parseFloat(num.toFixed(2)).toString();
};

// Format amount/price (always show 2 decimals for currency)
export const formatAmount = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '0.00';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  
  return num.toFixed(decimals);
};

// Format currency value without hardcoded symbol
export const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};
