const db = require('../database/connection');
const {
  asUnitMap,
  convertQuantity,
  listCompatibleUnits,
  unitDisplayLabel,
} = require('./unitConversion');

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

/**
 * Convert a BOM line quantity into the component item's stock unit.
 * If consumptionUnitId is null/empty, quantity is already in stock units.
 */
async function convertBomLineToStockQty(institutionId, {
  quantityRequired,
  consumptionUnitId = null,
  componentItemId,
  units = null,
} = {}) {
  const qty = Number(quantityRequired);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('BOM quantity must be a positive number');
  }

  const stockUnitId = await resolveItemStockUnitId(institutionId, componentItemId);
  const fromUnitId = consumptionUnitId ? String(consumptionUnitId).trim() : null;

  if (!fromUnitId || !stockUnitId || fromUnitId === stockUnitId) {
    return {
      quantityInStockUnit: qty,
      stockUnitId,
      consumptionUnitId: fromUnitId || stockUnitId,
      converted: false,
    };
  }

  const unitRows = units || await loadInstitutionUnits(institutionId);
  const map = asUnitMap(unitRows);
  const quantityInStockUnit = convertQuantity(qty, fromUnitId, stockUnitId, map);
  return {
    quantityInStockUnit,
    stockUnitId,
    consumptionUnitId: fromUnitId,
    converted: true,
  };
}

async function enrichBomComponentQuantities(institutionId, components = [], units = null) {
  const unitRows = units || await loadInstitutionUnits(institutionId);
  const map = asUnitMap(unitRows);
  const out = [];
  for (const c of components) {
    const quantityRequired = Number(c.quantity_required ?? c.quantityRequired);
    const consumptionUnitId = c.consumption_unit_id || c.consumptionUnitId || null;
    const componentItemId = c.component_item_id || c.componentItemId || c.itemId;
    const converted = await convertBomLineToStockQty(institutionId, {
      quantityRequired,
      consumptionUnitId,
      componentItemId,
      units: unitRows,
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
