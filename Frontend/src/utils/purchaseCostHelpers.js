/** Purchase-side unit cost helpers (tax on cost price → opening value / stock valuation). */

export function purchaseTaxMultiplier(taxRate) {
  const rate = Number(taxRate);
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return 1 + rate / 100;
}

export function unitCostIncludingTax(costPrice, purchaseTaxRate) {
  const cost = Number(costPrice);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  return Math.round(cost * purchaseTaxMultiplier(purchaseTaxRate) * 100) / 100;
}

export function openingValueWithPurchaseTax(openingStock, costPrice, purchaseTaxRate) {
  const qty = Number(openingStock);
  const unitInclTax = unitCostIncludingTax(costPrice, purchaseTaxRate);
  if (!Number.isFinite(qty) || qty <= 0 || unitInclTax <= 0) return 0;
  return Math.round(qty * unitInclTax * 100) / 100;
}

export function mergePurchaseCustomFields(customFields = {}, values = {}) {
  const next = { ...customFields };
  const assignOrDelete = (key, val) => {
    if (val != null && val !== '') next[key] = val;
    else delete next[key];
  };
  assignOrDelete('purchaseTaxRate', values.purchaseTaxRate != null && values.purchaseTaxRate !== ''
    ? Number(values.purchaseTaxRate)
    : null);
  assignOrDelete('purchaseAccount', values.purchaseAccount);
  assignOrDelete('purchaseDescription', values.purchaseDescription);
  assignOrDelete('preferredVendor', values.preferredVendor);
  assignOrDelete('salesDescription', values.salesDescription);
  assignOrDelete('salesAccount', values.salesAccount);
  return next;
}
