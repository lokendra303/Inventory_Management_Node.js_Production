/**
 * Unit-of-measure conversion using units.base_unit_id + conversion_factor.
 *
 * Rule: conversion_factor = how many base units equal 1 of this unit.
 * Example: Kilograms → base Grams, factor 1000 (1 kg = 1000 g).
 * Units with no base_unit_id are treated as their own base (factor 1).
 */

function asUnitMap(units = []) {
  const map = new Map();
  (units || []).forEach((u) => {
    if (u?.id) map.set(String(u.id), u);
  });
  return map;
}

/**
 * Resolve a unit to its base and the factor that converts 1 of this unit into base units.
 * Supports one hop: unit → base. If the pointed "base" itself has a base, we multiply factors
 * once more (shallow chain) then stop.
 */
function resolveToBase(unitRow, unitsById) {
  if (!unitRow?.id) {
    throw new Error('Unit is required for conversion');
  }
  const map = unitsById instanceof Map ? unitsById : asUnitMap(unitsById);
  const selfId = String(unitRow.id);
  const selfFactor = Number(unitRow.conversion_factor);
  const ownFactor = Number.isFinite(selfFactor) && selfFactor > 0 ? selfFactor : 1;

  const baseIdRaw = unitRow.base_unit_id ? String(unitRow.base_unit_id) : null;
  if (!baseIdRaw || baseIdRaw === selfId) {
    return { baseId: selfId, factorToBase: 1, unit: unitRow };
  }

  const base = map.get(baseIdRaw);
  if (!base) {
    // Base missing from map — treat linked factor as relative to unknown base id
    return { baseId: baseIdRaw, factorToBase: ownFactor, unit: unitRow };
  }

  const parentBaseId = base.base_unit_id ? String(base.base_unit_id) : null;
  if (!parentBaseId || parentBaseId === baseIdRaw) {
    return { baseId: baseIdRaw, factorToBase: ownFactor, unit: unitRow };
  }

  // One extra hop: e.g. unlikely nested; multiply factors
  const parentFactor = Number(base.conversion_factor);
  const parentOwn = Number.isFinite(parentFactor) && parentFactor > 0 ? parentFactor : 1;
  return {
    baseId: parentBaseId,
    factorToBase: ownFactor * parentOwn,
    unit: unitRow,
  };
}

function convertQuantity(qty, fromUnitId, toUnitId, unitsById) {
  const quantity = Number(qty);
  if (!Number.isFinite(quantity)) {
    throw new Error('Quantity must be a finite number');
  }
  if (!fromUnitId || !toUnitId) {
    throw new Error('Both source and target units are required for conversion');
  }
  if (String(fromUnitId) === String(toUnitId)) {
    return quantity;
  }

  const map = unitsById instanceof Map ? unitsById : asUnitMap(unitsById);
  const fromUnit = map.get(String(fromUnitId));
  const toUnit = map.get(String(toUnitId));
  if (!fromUnit) throw new Error(`Unknown source unit: ${fromUnitId}`);
  if (!toUnit) throw new Error(`Unknown target unit: ${toUnitId}`);

  const from = resolveToBase(fromUnit, map);
  const to = resolveToBase(toUnit, map);
  if (String(from.baseId) !== String(to.baseId)) {
    const fromLabel = fromUnit.symbol || fromUnit.name || fromUnitId;
    const toLabel = toUnit.symbol || toUnit.name || toUnitId;
    throw new Error(`Cannot convert between incompatible units (${fromLabel} ↔ ${toLabel})`);
  }
  if (!to.factorToBase || to.factorToBase <= 0) {
    throw new Error('Invalid conversion factor on target unit');
  }
  return (quantity * from.factorToBase) / to.factorToBase;
}

function listCompatibleUnits(stockUnitId, unitsById) {
  const map = unitsById instanceof Map ? unitsById : asUnitMap(unitsById);
  if (!stockUnitId) return Array.from(map.values());
  const stock = map.get(String(stockUnitId));
  if (!stock) return [];
  const { baseId } = resolveToBase(stock, map);
  return Array.from(map.values()).filter((u) => {
    try {
      return String(resolveToBase(u, map).baseId) === String(baseId);
    } catch {
      return false;
    }
  });
}

function unitDisplayLabel(unit) {
  if (!unit) return '';
  const name = unit.name || '';
  const symbol = unit.symbol && String(unit.symbol).trim().toLowerCase() !== String(name).trim().toLowerCase()
    ? ` (${unit.symbol})`
    : '';
  return `${name}${symbol}` || unit.symbol || unit.id;
}

module.exports = {
  asUnitMap,
  resolveToBase,
  convertQuantity,
  listCompatibleUnits,
  unitDisplayLabel,
};
