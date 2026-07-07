const looksLikeUuid = (value) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
);

const pickMetaValue = (val) => {
  if (val == null || val === '') return null;
  if (Array.isArray(val)) return val.filter(Boolean).join(', ') || null;
  return String(val).trim() || null;
};

export function resolveCatalogItemUnit(item = {}) {
  if (item.unit_name) return item.unit_name;
  const raw = item.unit;
  if (raw && !looksLikeUuid(raw)) return raw;
  return '—';
}

export function resolveCatalogItemSize(item = {}) {
  const cf = item.custom_fields && typeof item.custom_fields === 'object' ? item.custom_fields : {};
  const skuMeta = cf.skuMeta && typeof cf.skuMeta === 'object' ? cf.skuMeta : {};
  return (
    pickMetaValue(skuMeta.size)
    || pickMetaValue(cf.size)
    || pickMetaValue(cf.Size)
    || pickMetaValue(item.size)
    || '—'
  );
}

export function resolveCatalogItemCost(item = {}) {
  const cost = item.cost_price ?? item.costPrice;
  const n = Number(cost);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function resolveCatalogItemAvailableStock(item = {}) {
  const candidates = [
    item?.current_stock,
    item?.current_stock?.quantity_available,
    item?.currentStock?.quantityAvailable,
    item?.quantity_available,
    item?.quantityAvailable,
    item?.stock_available,
    item?.stockAvailable,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

export function getCatalogItemById(catalogItems = [], itemId) {
  if (!itemId) return null;
  return catalogItems.find((row) => String(row.id) === String(itemId)) || null;
}

export function calculateBomComponentLines(components = [], catalogItems = []) {
  return (components || [])
    .filter((row) => row?.itemId)
    .map((row) => {
      const item = getCatalogItemById(catalogItems, row.itemId);
      const qty = Number(row.quantityRequired) || 0;
      const unitCost = item ? resolveCatalogItemCost(item) : 0;
      const lineCost = qty * unitCost;
      return {
        itemId: row.itemId,
        sku: item?.sku || '—',
        name: item?.name || '—',
        type: item?.type || 'simple',
        size: item ? resolveCatalogItemSize(item) : '—',
        unit: item ? resolveCatalogItemUnit(item) : '—',
        quantityRequired: qty,
        unitCost,
        lineCost,
      };
    });
}

export function calculateBomComponentsSubtotal(components = [], catalogItems = []) {
  return calculateBomComponentLines(components, catalogItems)
    .reduce((sum, line) => sum + line.lineCost, 0);
}

export function calculateBomAdditionalTotal(charges = []) {
  return (charges || []).reduce((sum, row) => {
    const amount = Number(row?.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
}

export function calculateBomExpectedCost(components = [], catalogItems = [], additionalCharges = []) {
  const componentsSubtotal = calculateBomComponentsSubtotal(components, catalogItems);
  const additionalTotal = calculateBomAdditionalTotal(additionalCharges);
  return {
    componentsSubtotal,
    additionalTotal,
    expectedCost: Math.round((componentsSubtotal + additionalTotal) * 100) / 100,
  };
}

export const BOM_CHARGE_PRESETS = [
  'Electric bill',
  'Package charge',
  'Labour',
  'Transport',
  'Overhead',
];
