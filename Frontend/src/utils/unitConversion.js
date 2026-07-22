/**
 * Client-side UOM conversion (mirrors Backend/src/utils/unitConversion.js).
 * conversion_factor = how many base units equal 1 of this unit.
 */

export function asUnitMap(units = []) {
  const map = new Map();
  (units || []).forEach((u) => {
    if (u?.id) map.set(String(u.id), u);
  });
  return map;
}

export function resolveToBase(unitRow, unitsById) {
  if (!unitRow?.id) return null;
  const map = unitsById instanceof Map ? unitsById : asUnitMap(unitsById);
  const selfId = String(unitRow.id);
  const selfFactor = Number(unitRow.conversion_factor);
  const ownFactor = Number.isFinite(selfFactor) && selfFactor > 0 ? selfFactor : 1;
  const baseIdRaw = unitRow.base_unit_id ? String(unitRow.base_unit_id) : null;
  if (!baseIdRaw || baseIdRaw === selfId) {
    return { baseId: selfId, factorToBase: 1 };
  }
  const base = map.get(baseIdRaw);
  if (!base) return { baseId: baseIdRaw, factorToBase: ownFactor };
  const parentBaseId = base.base_unit_id ? String(base.base_unit_id) : null;
  if (!parentBaseId || parentBaseId === baseIdRaw) {
    return { baseId: baseIdRaw, factorToBase: ownFactor };
  }
  const parentFactor = Number(base.conversion_factor);
  const parentOwn = Number.isFinite(parentFactor) && parentFactor > 0 ? parentFactor : 1;
  return { baseId: parentBaseId, factorToBase: ownFactor * parentOwn };
}

export function convertQuantity(qty, fromUnitId, toUnitId, unitsById) {
  const quantity = Number(qty);
  if (!Number.isFinite(quantity) || !fromUnitId || !toUnitId) return null;
  if (String(fromUnitId) === String(toUnitId)) return quantity;
  const map = unitsById instanceof Map ? unitsById : asUnitMap(unitsById);
  const fromUnit = map.get(String(fromUnitId));
  const toUnit = map.get(String(toUnitId));
  if (!fromUnit || !toUnit) return null;
  const from = resolveToBase(fromUnit, map);
  const to = resolveToBase(toUnit, map);
  if (!from || !to || String(from.baseId) !== String(to.baseId) || !to.factorToBase) return null;
  return (quantity * from.factorToBase) / to.factorToBase;
}

export function listCompatibleUnits(stockUnitId, units = []) {
  const map = asUnitMap(units);
  if (!stockUnitId) return Array.isArray(units) ? units : [];
  const stock = map.get(String(stockUnitId));
  if (!stock) return [];
  const resolved = resolveToBase(stock, map);
  if (!resolved) return [stock];
  const strict = Array.from(map.values()).filter((u) => {
    const r = resolveToBase(u, map);
    return r && String(r.baseId) === String(resolved.baseId);
  });
  if (strict.length > 1) return strict;

  // Fallback: if conversion links are not fully configured, use same unit type family.
  const stockType = String(stock.type || '').trim().toLowerCase();
  if (stockType) {
    const sameType = Array.from(map.values()).filter(
      (u) => String(u?.type || '').trim().toLowerCase() === stockType
    );
    if (sameType.length > 1) return sameType;
  }
  return strict;
}

export function unitDisplayLabel(unit) {
  if (!unit) return '';
  const name = unit.name || '';
  const symbol = unit.symbol && String(unit.symbol).trim().toLowerCase() !== String(name).trim().toLowerCase()
    ? ` (${unit.symbol})`
    : '';
  return `${name}${symbol}` || unit.symbol || unit.id || '';
}

export function resolveItemStockUnitId(item, units = []) {
  if (!item) return null;
  const raw = item.unit_id || item.unitId || item.unit;
  if (!raw) return null;
  const s = String(raw);
  if (/^[0-9a-f-]{36}$/i.test(s)) return s;
  const hit = (units || []).find(
    (u) => String(u.id) === s
      || String(u.name || '').toLowerCase() === s.toLowerCase()
      || String(u.symbol || '').toLowerCase() === s.toLowerCase()
  );
  return hit?.id || null;
}
