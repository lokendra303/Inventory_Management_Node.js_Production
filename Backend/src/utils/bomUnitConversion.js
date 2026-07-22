const db = require('../database/connection');
const {
  asUnitMap,
  convertQuantity,
  listCompatibleUnits,
  unitDisplayLabel,
} = require('./unitConversion');
const {
  resolveItemPackSpecFromRow,
  extractComponentSize,
  bomLineToPackStockQty,
  findUnitByPackSymbol,
} = require('./packSizeHelpers');

async function loadInstitutionUnits(institutionId) {
  const rows = await db.query(
    `SELECT id, institution_id, name, symbol, type, base_unit_id, conversion_factor, status
       FROM units
      WHERE institution_id = ? AND status = 'active'`,
    [institutionId]
  );
  return rows;
}

async function resolveItemStockUnitId(institutionId, itemId) {
  const rows = await db.query(
    `SELECT i.unit AS unit_raw, u.id AS unit_id
       FROM items i
       LEFT JOIN units u
         ON u.institution_id = i.institution_id
        AND (u.id = i.unit OR u.name = i.unit OR u.symbol = i.unit)
      WHERE i.institution_id = ? AND i.id = ?
      LIMIT 1`,
    [institutionId, itemId]
  );
  if (!rows.length) throw new Error('Component item not found');
  const row = rows[0];
  if (row.unit_id) return String(row.unit_id);
  // unit column may already be a UUID that failed join (inactive) — still try as id
  const raw = row.unit_raw ? String(row.unit_raw).trim() : '';
  if (/^[0-9a-f-]{36}$/i.test(raw)) return raw;
  return null;
}

async function loadComponentItemRow(institutionId, componentItemId) {
  const rows = await db.query(
    `SELECT i.id, i.unit AS unit_id, i.custom_fields, i.is_breakable
       FROM items i
      WHERE i.institution_id = ? AND i.id = ?
      LIMIT 1`,
    [institutionId, componentItemId]
  );
  return rows[0] || null;
}

/**
 * Convert a BOM line quantity into stock (pack count when item has a pack size).
 *
 * Pack model: stock qty = number of packs; size (e.g. 7g) is content per pack.
 * - consumeFullPack: qty is packs → deduct packs directly (10 − 1).
 * - otherwise: qty is content (g/ml/…) → deduct content/packSize packs
 *   (5g from 10×7g → deduct 5/7 pack).
 */
async function convertBomLineToStockQty(institutionId, {
  quantityRequired,
  consumptionUnitId = null,
  consumeFullPack = false,
  componentItemId,
  units = null,
  componentRow = null,
} = {}) {
  const qty = Number(quantityRequired);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('BOM quantity must be a positive number');
  }

  const stockUnitId = await resolveItemStockUnitId(institutionId, componentItemId);
  const loadedItemRow = await loadComponentItemRow(institutionId, componentItemId);
  const itemRow = loadedItemRow
    ? {
      ...loadedItemRow,
      ...(componentRow || {}),
      id: loadedItemRow.id,
      unit_id: loadedItemRow.unit_id,
      custom_fields: loadedItemRow.custom_fields,
      is_breakable: loadedItemRow.is_breakable,
    }
    : componentRow;
  const unitRows = units || await loadInstitutionUnits(institutionId);
  const map = asUnitMap(unitRows);

  const packSpec = itemRow
    ? resolveItemPackSpecFromRow({
      ...itemRow,
      component_size: extractComponentSize(itemRow.custom_fields),
    }, map)
    : null;

  if (packSpec) {
    const packUnit = findUnitByPackSymbol(packSpec, map);
    const itemIsBreakable = itemRow.is_breakable === undefined || itemRow.is_breakable === null
      ? true
      : !(itemRow.is_breakable === 0 || itemRow.is_breakable === false || itemRow.is_breakable === '0');
    let effectiveConsumeFullPack = !!consumeFullPack;
    if (!itemIsBreakable) {
      if (!effectiveConsumeFullPack) {
        throw new Error(
          `Component is not breakable — BOM must use full pack (${packSpec.label}) only`
        );
      }
      effectiveConsumeFullPack = true;
    }
    const effectiveConsumptionUnitId = effectiveConsumeFullPack
      ? (consumptionUnitId || stockUnitId)
      : (consumptionUnitId || packUnit?.id || stockUnitId);
    const quantityInStockUnit = bomLineToPackStockQty(qty, {
      consumeFullPack: effectiveConsumeFullPack,
      packSpec,
      consumptionUnitId: effectiveConsumptionUnitId,
      unitsById: map,
    });
    if (quantityInStockUnit == null || !(quantityInStockUnit > 0)) {
      throw new Error(
        effectiveConsumeFullPack
          ? 'BOM pack quantity must be a positive number'
          : `Cannot convert BOM qty to packs of ${packSpec.label} — check consumption UOM`
      );
    }
    return {
      quantityInStockUnit,
      stockUnitId,
      consumptionUnitId: effectiveConsumptionUnitId,
      converted: !effectiveConsumeFullPack,
      consumeFullPack: effectiveConsumeFullPack,
      packSizeLabel: packSpec.label,
      isBreakable: itemIsBreakable,
    };
  }

  const fromUnitId = consumptionUnitId ? String(consumptionUnitId).trim() : null;

  if (!fromUnitId || !stockUnitId || fromUnitId === stockUnitId) {
    return {
      quantityInStockUnit: qty,
      stockUnitId,
      consumptionUnitId: fromUnitId || stockUnitId,
      converted: false,
      consumeFullPack: false,
    };
  }

  const quantityInStockUnit = convertQuantity(qty, fromUnitId, stockUnitId, map);
  return {
    quantityInStockUnit,
    stockUnitId,
    consumptionUnitId: fromUnitId,
    converted: true,
    consumeFullPack: false,
  };
}

async function enrichBomComponentQuantities(institutionId, components = [], units = null) {
  const unitRows = units || await loadInstitutionUnits(institutionId);
  const map = asUnitMap(unitRows);
  const out = [];
  for (const c of components) {
    const quantityRequired = Number(c.quantity_required ?? c.quantityRequired);
    const consumptionUnitId = c.consumption_unit_id || c.consumptionUnitId || null;
    const consumeFullPack = !!(c.consume_full_pack || c.consumeFullPack);
    const componentItemId = c.component_item_id || c.componentItemId || c.itemId;
    const converted = await convertBomLineToStockQty(institutionId, {
      quantityRequired,
      consumptionUnitId,
      consumeFullPack,
      componentItemId,
      units: unitRows,
      componentRow: c.component_item_id ? c : null,
    });
    const stockUnit = converted.stockUnitId ? map.get(String(converted.stockUnitId)) : null;
    const consumptionUnit = converted.consumptionUnitId
      ? map.get(String(converted.consumptionUnitId))
      : null;
    out.push({
      ...c,
      quantityRequiredPerKit: quantityRequired,
      quantityRequiredInStockUnit: converted.quantityInStockUnit,
      stockUnitId: converted.stockUnitId,
      consumptionUnitId: converted.consumptionUnitId,
      stockUnit: unitDisplayLabel(stockUnit) || c.unit_name || c.unit || null,
      consumptionUnit: unitDisplayLabel(consumptionUnit) || unitDisplayLabel(stockUnit) || null,
      consumeFullPack: converted.consumeFullPack || false,
      packSizeLabel: converted.packSizeLabel || null,
    });
  }
  return out;
}

module.exports = {
  loadInstitutionUnits,
  resolveItemStockUnitId,
  convertBomLineToStockQty,
  enrichBomComponentQuantities,
  listCompatibleUnits,
  asUnitMap,
  unitDisplayLabel,
};
