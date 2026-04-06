const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

const PRICE_TYPE_MAP = {
  cost_price:    'cost',
  selling_price: 'selling',
  mrp:           'mrp'
};

class ItemPriceHistoryService {
  async recordPriceChange(institutionId, itemId, userId, oldPrices, newPrices, reason = null) {
    const today = new Date().toISOString().split('T')[0];

    for (const [field, priceType] of Object.entries(PRICE_TYPE_MAP)) {
      const oldVal = oldPrices[field] != null ? parseFloat(oldPrices[field]) : null;
      const newVal = newPrices[field] != null ? parseFloat(newPrices[field]) : null;

      if (newVal == null || oldVal === newVal) continue;

      await db.query(
        `INSERT INTO item_price_history
         (id, institution_id, item_id, price_type, old_price, new_price, effective_date, reason, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), institutionId, itemId, priceType, oldVal ?? newVal, newVal, today, reason, userId]
      );
    }

    logger.info('Price history recorded', { itemId, institutionId });
  }

  async getPriceHistory(institutionId, itemId, { priceType, limit = 50, offset = 0 } = {}) {
    let query = `
      SELECT ph.*, u.first_name, u.last_name
      FROM item_price_history ph
      LEFT JOIN institution_users u ON ph.changed_by = u.id
      WHERE ph.institution_id = ? AND ph.item_id = ?`;
    const params = [institutionId, itemId];

    if (priceType) {
      query += ' AND ph.price_type = ?';
      params.push(priceType);
    }

    query += ` ORDER BY ph.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;


    return db.query(query, params);
  }
}

module.exports = new ItemPriceHistoryService();
