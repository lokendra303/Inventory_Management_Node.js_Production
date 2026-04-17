const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS price_lists (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(255),
      currency VARCHAR(10) DEFAULT 'USD',
      pricelist_type ENUM('sales','purchase') DEFAULT 'sales',
      discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
      discount_value DECIMAL(10,4) DEFAULT 0,
      is_default TINYINT(1) DEFAULT 0,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS price_list_items (
      id VARCHAR(36) PRIMARY KEY,
      price_list_id VARCHAR(36) NOT NULL,
      item_id VARCHAR(36) NOT NULL,
      custom_price DECIMAL(15,4),
      discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
      discount_value DECIMAL(10,4) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pl_item (price_list_id, item_id),
      FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE
    )
  `);
  tablesReady = true;
}

class PriceListService {
  async getAll(institutionId) {
    await ensureTables();
    return db.query(
      `SELECT pl.*, COUNT(pli.id) as item_count
       FROM price_lists pl
       LEFT JOIN price_list_items pli ON pli.price_list_id = pl.id
       WHERE pl.institution_id = ? AND pl.status = 'active'
       GROUP BY pl.id ORDER BY pl.is_default DESC, pl.name`,
      [institutionId]
    );
  }

  async getOne(institutionId, id) {
    await ensureTables();
    const [pl] = await db.query(
      'SELECT * FROM price_lists WHERE institution_id=? AND id=?',
      [institutionId, id]
    );
    if (!pl) throw new Error('Price list not found');
    const items = await db.query(
      `SELECT pli.*, i.name as item_name, i.sku, i.selling_price as base_price
       FROM price_list_items pli
       JOIN items i ON pli.item_id = i.id
       WHERE pli.price_list_id = ?`,
      [id]
    );
    return { ...pl, items };
  }

  async create(institutionId, { name, description, currency, pricelistType, discountType, discountValue, isDefault }) {
    await ensureTables();
    if (isDefault) {
      await db.query('UPDATE price_lists SET is_default=0 WHERE institution_id=? AND pricelist_type=?', [institutionId, pricelistType || 'sales']);
    }
    // If no currency passed, use institution's active currency
    let finalCurrency = currency;
    if (!finalCurrency) {
      const inst = await db.query('SELECT currency FROM institutions WHERE id=?', [institutionId]);
      finalCurrency = inst[0]?.currency || 'USD';
    }
    const id = uuidv4();
    await db.query(
      `INSERT INTO price_lists (id, institution_id, name, description, currency, pricelist_type, discount_type, discount_value, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, name, description || null, finalCurrency,
       pricelistType || 'sales', discountType || 'percentage', discountValue || 0, isDefault ? 1 : 0]
    );
    logger.info('Price list created', { id, institutionId, name, currency: finalCurrency });
    return id;
  }

  async update(institutionId, id, data) {
    await ensureTables();
    const fields = [], vals = [];
    const map = { name: 'name', description: 'description', currency: 'currency',
                  pricelistType: 'pricelist_type', discountType: 'discount_type',
                  discountValue: 'discount_value', isDefault: 'is_default', status: 'status' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { fields.push(`${col}=?`); vals.push(data[k]); }
    }
    if (!fields.length) throw new Error('Nothing to update');
    if (data.isDefault) {
      await db.query('UPDATE price_lists SET is_default=0 WHERE institution_id=?', [institutionId]);
    }
    fields.push('updated_at=NOW()');
    vals.push(institutionId, id);
    await db.query(`UPDATE price_lists SET ${fields.join(',')} WHERE institution_id=? AND id=?`, vals);
    return true;
  }

  async delete(institutionId, id) {
    await ensureTables();
    await db.query('UPDATE price_lists SET status="inactive" WHERE institution_id=? AND id=?', [institutionId, id]);
    return true;
  }

  async upsertItem(priceListId, { itemId, customPrice, discountType, discountValue }) {
    await ensureTables();
    const existing = await db.query('SELECT id FROM price_list_items WHERE price_list_id=? AND item_id=?', [priceListId, itemId]);
    if (existing.length > 0) {
      await db.query(
        'UPDATE price_list_items SET custom_price=?, discount_type=?, discount_value=?, updated_at=NOW() WHERE price_list_id=? AND item_id=?',
        [customPrice || null, discountType || 'percentage', discountValue || 0, priceListId, itemId]
      );
      return existing[0].id;
    }
    const id = uuidv4();
    await db.query(
      'INSERT INTO price_list_items (id, price_list_id, item_id, custom_price, discount_type, discount_value) VALUES (?,?,?,?,?,?)',
      [id, priceListId, itemId, customPrice || null, discountType || 'percentage', discountValue || 0]
    );
    return id;
  }

  async removeItem(priceListId, itemId) {
    await ensureTables();
    await db.query('DELETE FROM price_list_items WHERE price_list_id=? AND item_id=?', [priceListId, itemId]);
    return true;
  }

  async getPriceForItem(institutionId, priceListId, itemId) {
    await ensureTables();
    const [item] = await db.query(
      `SELECT pli.*, i.selling_price as base_price, pl.discount_type as list_discount_type, pl.discount_value as list_discount_value
       FROM price_list_items pli
       JOIN items i ON pli.item_id = i.id
       JOIN price_lists pl ON pli.price_list_id = pl.id
       WHERE pl.institution_id=? AND pli.price_list_id=? AND pli.item_id=?`,
      [institutionId, priceListId, itemId]
    );
    if (!item) return null;
    let finalPrice = item.custom_price || item.base_price;
    if (!item.custom_price) {
      const dv = parseFloat(item.list_discount_value) || 0;
      finalPrice = item.list_discount_type === 'percentage'
        ? item.base_price * (1 - dv / 100)
        : item.base_price - dv;
    }
    return { ...item, final_price: Math.max(0, finalPrice) };
  }
}

module.exports = new PriceListService();
