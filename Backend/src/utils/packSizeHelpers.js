const WEIGHT_SYMBOLS = new Set(['g', 'gm', 'gram', 'grams', 'kg', 'kilogram', 'kilograms']);
const VOLUME_SYMBOLS = new Set(['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres']);
const COUNT_SYMBOLS = new Set(['pcs', 'pc', 'piece', 'pieces', 'each', 'ea', '']);
const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|kg|kilogram|kilograms|ml|millilitre|millilitres|milliliter|milliliters|l|liter|liters|litre|litres|pcs|pc|piece|pieces|each|ea)?$/i;

function normalizeUnitSymbol(symbol = '') {
  const s = String(symbol || '').trim().toLowerCase();
  if (s === 'gm') return 'g';
  if (['kilogram', 'kilograms'].includes(s)) return 'kg';
  if (['millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(s)) return 'ml';
  if (['liter', 'liters', 'litre', 'litres', 'ltr', 'lt'].includes(s)) return 'l';
  if (['piece', 'pieces', 'each', 'ea'].includes(s)) return 'pcs';
  return s;
}

function unitRowSymbol(unit) {
  return normalizeUnitSymbol(unit?.symbol || unit?.name || '');
}

function unitKind(symbol) {
  const s = normalizeUnitSymbol(symbol);
  if (WEIGHT_SYMBOLS.has(s)) return 'weight';
  if (VOLUME_SYMBOLS.has(s)) return 'volume';
  if (COUNT_SYMBOLS.has(s)) return 'count';
  return null;
}

function extractComponentSize(customFields = {}) {
  const cf = typeof customFields === 'object' && customFields ? customFields : {};
  const skuMeta = cf.skuMeta && typeof cf.skuMeta === 'object' ? cf.skuMeta : {};
  const pick = (v) => {
    if (v == null || v === '') return null;
    if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean).join(', ') || null;
    return String(v).trim() || null;
  };
  return pick(skuMeta.size) || pick(cf.size) || pick(cf.Size) || null;
}

function parsePackSize(sizeText) {
  const raw = String(sizeText || '').trim();
  if (!raw) return null;
  const match = raw.match(SIZE_PATTERN);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unitSymbol = normalizeUnitSymbol(match[2] || 'pcs');
  const kind = unitKind(unitSymbol);
  if (!kind) return null;
  return { amount, unitSymbol, kind, label: raw };
}

function resolveItemPackSpecFromRow(itemRow = {}, unitsById = new Map()) {
  const sizeText = itemRow.component_size || extractComponentSize(itemRow.custom_fields);
  const pack = parsePackSize(sizeText);
  if (!pack) return null;

  const stockUnitId = itemRow.unit_id || itemRow.unitId || null;
  const stockUnit = stockUnitId ? unitsById.get(String(stockUnitId)) : null;
  const stockSymbol = stockUnit ? unitRowSymbol(stockUnit) : '';
  const stockKind = unitKind(stockSymbol);

  if (pack.kind === 'count' || stockKind === 'count') {
    return { ...pack, stockUnitId, usesPackStock: true };
  }
  if (pack.kind && stockKind && pack.kind === stockKind) {
    return { ...pack, stockUnitId, usesPackStock: true };
  }
  return null;
}

function itemUsesPackStockFromRow(itemRow = {}, unitsById = new Map()) {
  return Boolean(resolveItemPackSpecFromRow(itemRow, unitsById));
}

function findUnitByPackSymbol(packSpec, unitsById) {
  if (!packSpec?.unitSymbol) return null;
  const target = packSpec.unitSymbol;
  const map = unitsById instanceof Map ? unitsById : new Map();
  for (const unit of map.values()) {
    if (unitRowSymbol(unit) === target) return unit;
  }
  return null;
}

function packCountToContentQty(packCount, packSpec) {
  const packs = Number(packCount);
  if (!Number.isFinite(packs) || !packSpec?.amount || packSpec.amount <= 0) return null;
  return packs * packSpec.amount;
}

function contentQtyToPackCount(contentQty, packSpec) {
  const content = Number(contentQty);
  if (!Number.isFinite(content) || !packSpec?.amount || packSpec.amount <= 0) return null;
  return content / packSpec.amount;
}

/**
 * BOM line qty → stock deduction in pack count.
 * Full pack: qty is packs. Partial: qty is content (g/ml) → packs = content / packSize.
 */
function bomLineToPackStockQty(qty, {
  consumeFullPack = false,
  packSpec = null,
  consumptionUnitId = null,
  unitsById = new Map(),
} = {}) {
  if (!packSpec) return null;
  const amount = Number(qty);
  if (!Number.isFinite(amount)) return null;
  if (consumeFullPack) return amount;

  const { convertQuantity } = require('./unitConversion');
  const packUnit = findUnitByPackSymbol(packSpec, unitsById);
  let contentQty = amount;
  if (packUnit?.id && consumptionUnitId && String(consumptionUnitId) !== String(packUnit.id)) {
    const converted = convertQuantity(amount, consumptionUnitId, packUnit.id, unitsById);
    if (converted == null) return null;
    contentQty = converted;
  }
  return contentQtyToPackCount(contentQty, packSpec);
}

function packSizeInStockUnit(packSpec) {
  if (!packSpec || !Number.isFinite(packSpec.amount) || packSpec.amount <= 0) return null;
  return packSpec.amount;
}

function packCountToStockQty(packCount, packSpec) {
  return packCountToContentQty(packCount, packSpec);
}

function stockQtyToPackCount(stockQty, packSpec) {
  return contentQtyToPackCount(stockQty, packSpec);
}

module.exports = {
  parsePackSize,
  extractComponentSize,
  resolveItemPackSpecFromRow,
  itemUsesPackStockFromRow,
  findUnitByPackSymbol,
  packCountToContentQty,
  contentQtyToPackCount,
  bomLineToPackStockQty,
  packSizeInStockUnit,
  packCountToStockQty,
  stockQtyToPackCount,
};
