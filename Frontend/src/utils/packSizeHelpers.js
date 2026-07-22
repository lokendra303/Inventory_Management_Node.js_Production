import { resolveCatalogItemSize } from './bomCostHelpers';
import { asUnitMap, convertQuantity, resolveItemStockUnitId } from './unitConversion';

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(g|gm|gram|grams|kg|kilogram|kilograms|ml|millilitre|millilitres|milliliter|milliliters|l|liter|liters|litre|litres|pcs|pc|piece|pieces|each|ea)?$/i;

const WEIGHT_SYMBOLS = new Set(['g', 'gm', 'gram', 'grams', 'kg', 'kilogram', 'kilograms']);
const VOLUME_SYMBOLS = new Set(['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters', 'l', 'liter', 'liters', 'litre', 'litres']);
const COUNT_SYMBOLS = new Set(['pcs', 'pc', 'piece', 'pieces', 'each', 'ea', '']);

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

/** Parse item size text like "7g", "100 ML", "1 pcs" → { amount, unitSymbol, kind } */
export function parsePackSize(sizeText) {
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

export function resolveItemPackSpec(item = {}, units = []) {
  const sizeText = resolveCatalogItemSize(item);
  const pack = parsePackSize(sizeText);
  if (!pack) return null;
  const stockUnitId = resolveItemStockUnitId(item, units);
  const map = asUnitMap(units);
  const stockUnit = stockUnitId ? map.get(String(stockUnitId)) : null;
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

/** True when item size (e.g. 7g) means each stock unit is one pack of that size. */
export function itemUsesPackStock(item = {}, units = []) {
  return Boolean(resolveItemPackSpec(item, units));
}

/** Pack may be opened for partial BOM qty. Default true when unset. */
export function itemIsBreakable(item = {}) {
  if (item?.is_breakable === 0 || item?.is_breakable === false || item?.is_breakable === '0') {
    return false;
  }
  if (item?.isBreakable === 0 || item?.isBreakable === false || item?.isBreakable === '0') {
    return false;
  }
  return true;
}

export function findUnitByPackSymbol(packSpec, units = []) {
  if (!packSpec?.unitSymbol) return null;
  const target = packSpec.unitSymbol;
  return (units || []).find((u) => unitRowSymbol(u) === target) || null;
}

/** Total pack content (e.g. 10 packs × 7g → 70). Stock qty is pack count. */
export function packCountToContentQty(packCount, packSpec) {
  const packs = Number(packCount);
  if (!Number.isFinite(packs) || !packSpec?.amount || packSpec.amount <= 0) return null;
  return packs * packSpec.amount;
}

/** Content amount → pack count (e.g. 5g / 7g → 5/7 pack). */
export function contentQtyToPackCount(contentQty, packSpec) {
  const content = Number(contentQty);
  if (!Number.isFinite(content) || !packSpec?.amount || packSpec.amount <= 0) return null;
  return content / packSpec.amount;
}

/**
 * BOM line qty → stock deduction in pack count.
 * - Full pack: qty is packs (10 − 1).
 * - Partial: qty is content (g/ml); deduct qty / packSize packs from stock
 *   (5g from 10×7g → deduct 5/7 pack).
 */
export function bomLineToPackStockQty(qty, {
  consumeFullPack = false,
  packSpec = null,
  consumptionUnitId = null,
  units = [],
} = {}) {
  if (!packSpec) return null;
  const amount = Number(qty);
  if (!Number.isFinite(amount)) return null;
  if (consumeFullPack) return amount;

  const packUnit = findUnitByPackSymbol(packSpec, units);
  let contentQty = amount;
  if (packUnit?.id && consumptionUnitId && String(consumptionUnitId) !== String(packUnit.id)) {
    const converted = convertQuantity(amount, consumptionUnitId, packUnit.id, units);
    if (converted == null) return null;
    contentQty = converted;
  }
  return contentQtyToPackCount(contentQty, packSpec);
}

/** @deprecated use packCountToContentQty — stock is pack count, not stock-UOM grams */
export function packSizeInStockUnit(packSpec) {
  if (!packSpec || !Number.isFinite(packSpec.amount) || packSpec.amount <= 0) return null;
  return packSpec.amount;
}

export function packCountToStockQty(packCount, packSpec) {
  return packCountToContentQty(packCount, packSpec);
}

export function stockQtyToPackCount(stockQty, packSpec) {
  return contentQtyToPackCount(stockQty, packSpec);
}

export function suggestBomLineForPackItem(item = {}, units = []) {
  const spec = resolveItemPackSpec(item, units);
  if (!spec) return null;
  const breakable = itemIsBreakable(item);
  return {
    quantityRequired: 1,
    consumptionUnitId: spec.stockUnitId || null,
    consumeFullPack: true,
    packSizeLabel: spec.label,
    isBreakable: breakable,
  };
}
