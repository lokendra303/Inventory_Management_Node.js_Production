const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class VendorPriceListService {
  async upsertPrice(institutionId, data, userId) {
    const { vendorId, itemId, unitCost, currency = 'USD', minOrderQty = 1, leadTimeDays = 0, validFrom, validTo, notes } = data;

    const existing = await db.query(
      'SELECT id FROM vendor_price_lists WHERE institution_id = ? AND vendor_id = ? AND item_id = ?',
      [institutionId, vendorId, itemId]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE vendor_price_lists SET unit_cost=?, currency=?, min_order_qty=?, lead_time_days=?,
         valid_from=?, valid_to=?, notes=?, is_active=1, updated_at=NOW()
         WHERE institution_id=? AND vendor_id=? AND item_id=?`,
        [unitCost, currency, minOrderQty, leadTimeDays, validFrom || null, validTo || null, notes || null,
         institutionId, vendorId, itemId]
      );
      return existing[0].id;
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO vendor_price_lists
       (id, institution_id, vendor_id, item_id, unit_cost, currency, min_order_qty, lead_time_days, valid_from, valid_to, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, vendorId, itemId, unitCost, currency, minOrderQty, leadTimeDays,
       validFrom || null, validTo || null, notes || null, userId]
    );
    logger.info('Vendor price upserted', { id, institutionId, vendorId, itemId, userId });
    return id;
  }

  async getVendorPrices(institutionId, vendorId) {
    return db.query(
      `SELECT vpl.*, i.name as item_name, i.sku
       FROM vendor_price_lists vpl
       JOIN items i ON vpl.item_id = i.id
       WHERE vpl.institution_id = ? AND vpl.vendor_id = ? AND vpl.is_active = 1
       ORDER BY i.name`,
      [institutionId, vendorId]
    );
  }

  async getItemVendorPrices(institutionId, itemId) {
    return db.query(
      `SELECT vpl.*, v.display_name as vendor_name, v.vendor_code
       FROM vendor_price_lists vpl
       JOIN vendors v ON vpl.vendor_id = v.id
       WHERE vpl.institution_id = ? AND vpl.item_id = ? AND vpl.is_active = 1
       ORDER BY vpl.unit_cost ASC`,
      [institutionId, itemId]
    );
  }

  /** Returns the best (lowest) price for an item from a specific vendor */
  async getBestPrice(institutionId, vendorId, itemId) {
    const rows = await db.query(
      `SELECT unit_cost, currency, lead_time_days FROM vendor_price_lists
       WHERE institution_id=? AND vendor_id=? AND item_id=? AND is_active=1
         AND (valid_to IS NULL OR valid_to >= CURDATE())
       ORDER BY unit_cost ASC LIMIT 1`,
      [institutionId, vendorId, itemId]
    );
    return rows[0] || null;
  }

  async deletePrice(institutionId, priceId, userId) {
    const result = await db.query(
      'UPDATE vendor_price_lists SET is_active=0, updated_at=NOW() WHERE institution_id=? AND id=?',
      [institutionId, priceId]
    );
    if (result.affectedRows === 0) throw new Error('Price not found');
    logger.info('Vendor price deleted', { priceId, institutionId, userId });
    return true;
  }
}

module.exports = new VendorPriceListService();
