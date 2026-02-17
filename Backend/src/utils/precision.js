// Utility functions to handle floating-point precision issues

const roundToTwo = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const safeAdd = (...numbers) => {
  return roundToTwo(numbers.reduce((sum, num) => sum + parseFloat(num || 0), 0));
};

const safeSubtract = (a, b) => {
  return roundToTwo(parseFloat(a || 0) - parseFloat(b || 0));
};

const safeMultiply = (a, b) => {
  return roundToTwo(parseFloat(a || 0) * parseFloat(b || 0));
};

const safeDivide = (a, b) => {
  const divisor = parseFloat(b || 0);
  if (divisor === 0) return 0;
  return roundToTwo(parseFloat(a || 0) / divisor);
};

module.exports = {
  roundToTwo,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide
};
