const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

const DEFAULT_ITEM_TYPES = ['simple', 'variant', 'composite', 'service'];

/** Core types required by inventory, BOM, and variant flows — cannot be removed. */
const PROTECTED_ITEM_TYPES = new Set(['simple', 'variant', 'composite']);

class ItemTypeService {
  async ensureDefaultTypes(institutionId) {
    for (const name of DEFAULT_ITEM_TYPES) {
      const existing = await db.query(
        'SELECT id FROM item_types WHERE institution_id = ? AND name = ? LIMIT 1',
        [institutionId, name]
      );
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO item_types (id, institution_id, name, is_active)
           VALUES (?, ?, ?, TRUE)`,
          [uuidv4(), institutionId, name]
        );
      }
    }
  }

  async getItemTypes(institutionId, filters = {}) {
    await this.ensureDefaultTypes(institutionId);

    let query = 'SELECT id, name, is_active, created_at, updated_at FROM item_types WHERE institution_id = ?';
    const params = [institutionId];

    if (filters.activeOnly) {
      query += ' AND is_active = TRUE';
    }

    query += ' ORDER BY name';
    return db.query(query, params);
  }

  async createItemType(institutionId, typeData, userId) {
    const name = String(typeData?.name || '').trim().toLowerCase();
    if (!name) throw new Error('Type name is required');

    const existing = await db.query(
      'SELECT id FROM item_types WHERE institution_id = ? AND name = ? LIMIT 1',
      [institutionId, name]
    );
    if (existing.length > 0) throw new Error('Item type already exists');

    const typeId = uuidv4();
    await db.query(
      `INSERT INTO item_types (id, institution_id, name, is_active)
       VALUES (?, ?, ?, TRUE)`,
      [typeId, institutionId, name]
    );

    logger.info('Item type created', { typeId, institutionId, name, userId });
    return typeId;
  }

  async deleteItemType(institutionId, typeId) {
    const typeRows = await db.query(
      'SELECT id, name FROM item_types WHERE institution_id = ? AND id = ? LIMIT 1',
      [institutionId, typeId]
    );
    if (typeRows.length === 0) throw new Error('Item type not found');
    const itemType = typeRows[0];

    if (PROTECTED_ITEM_TYPES.has(String(itemType.name || '').toLowerCase())) {
      throw new Error(
        `Cannot delete built-in item type "${itemType.name}". Simple, variant, and composite types are required by the system.`
      );
    }

    const inUse = await db.query(
      'SELECT COUNT(*) AS count FROM items WHERE institution_id = ? AND type = ?',
      [institutionId, itemType.name]
    );
    if ((inUse[0]?.count || 0) > 0) {
      throw new Error('Cannot delete item type that is already used by items');
    }

    await db.query(
      'DELETE FROM item_types WHERE institution_id = ? AND id = ?',
      [institutionId, typeId]
    );

    logger.info('Item type deleted', { typeId, institutionId, name: itemType.name });
    return true;
  }
}

module.exports = new ItemTypeService();
module.exports.PROTECTED_ITEM_TYPES = PROTECTED_ITEM_TYPES;
module.exports.DEFAULT_ITEM_TYPES = DEFAULT_ITEM_TYPES;
