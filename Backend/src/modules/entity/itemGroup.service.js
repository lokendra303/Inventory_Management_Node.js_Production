const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class ItemGroupService {
  _normalizeName(name) {
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('Item group name is required');
    return normalized;
  }

  _normalizeDescription(description) {
    const normalized = String(description || '').trim();
    return normalized || null;
  }

  async getItemGroups(institutionId, filters = {}) {
    let query = `
      SELECT
        ig.id,
        ig.name,
        ig.description,
        ig.is_active,
        ig.created_at,
        ig.updated_at,
        COUNT(DISTINCT i.id) AS usage_count
      FROM item_groups ig
      LEFT JOIN items i
        ON i.institution_id = ig.institution_id
       AND (
         i.item_group_id = ig.id
         OR (i.item_group_id IS NULL AND i.item_group = ig.name)
       )
      WHERE ig.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.activeOnly) {
      query += ' AND ig.is_active = TRUE';
    }

    if (filters.search) {
      query += ' AND (ig.name LIKE ? OR COALESCE(ig.description, \'\') LIKE ?)';
      params.push(`%${String(filters.search).trim()}%`, `%${String(filters.search).trim()}%`);
    }

    query += ' GROUP BY ig.id ORDER BY ig.name ASC';

    const rows = await db.query(query, params);
    return rows.map((row) => ({
      ...row,
      is_active: !!Number(row.is_active),
      usage_count: Number(row.usage_count || 0)
    }));
  }

  async createItemGroup(institutionId, groupData, userId) {
    const name = this._normalizeName(groupData?.name);
    const description = this._normalizeDescription(groupData?.description);
    const isActive = groupData?.isActive !== false;

    const existing = await db.query(
      'SELECT id FROM item_groups WHERE institution_id = ? AND name = ? LIMIT 1',
      [institutionId, name]
    );
    if (existing.length > 0) throw new Error('Item group already exists');

    const groupId = uuidv4();
    await db.query(
      `INSERT INTO item_groups (id, institution_id, name, description, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [groupId, institutionId, name, description, isActive, userId || null]
    );

    logger.info('Item group created', { groupId, institutionId, name, userId });
    return groupId;
  }

  async updateItemGroup(institutionId, groupId, updateData, userId) {
    const rows = await db.query(
      'SELECT id, name, description, is_active FROM item_groups WHERE institution_id = ? AND id = ? LIMIT 1',
      [institutionId, groupId]
    );
    if (rows.length === 0) throw new Error('Item group not found');

    const current = rows[0];
    const updateFields = [];
    const updateValues = [];
    let nextName = current.name;

    if (updateData?.name !== undefined) {
      nextName = this._normalizeName(updateData.name);
      const existing = await db.query(
        'SELECT id FROM item_groups WHERE institution_id = ? AND name = ? AND id <> ? LIMIT 1',
        [institutionId, nextName, groupId]
      );
      if (existing.length > 0) throw new Error('Item group already exists');
      updateFields.push('name = ?');
      updateValues.push(nextName);
    }

    if (updateData?.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(this._normalizeDescription(updateData.description));
    }

    if (updateData?.isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(!!updateData.isActive);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    await db.query(
      `UPDATE item_groups SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      [...updateValues, institutionId, groupId]
    );

    if (nextName !== current.name) {
      await db.query(
        `UPDATE items
         SET item_group = ?, item_group_id = ?
         WHERE institution_id = ?
           AND (item_group_id = ? OR (item_group_id IS NULL AND item_group = ?))`,
        [nextName, groupId, institutionId, groupId, current.name]
      );
    }

    logger.info('Item group updated', { groupId, institutionId, userId });
    return true;
  }

  async deleteItemGroup(institutionId, groupId, userId) {
    const rows = await db.query(
      'SELECT id, name FROM item_groups WHERE institution_id = ? AND id = ? LIMIT 1',
      [institutionId, groupId]
    );
    if (rows.length === 0) throw new Error('Item group not found');

    const group = rows[0];
    const usage = await db.query(
      `SELECT COUNT(*) AS count
       FROM items
       WHERE institution_id = ?
         AND (item_group_id = ? OR (item_group_id IS NULL AND item_group = ?))`,
      [institutionId, groupId, group.name]
    );
    if (Number(usage[0]?.count || 0) > 0) {
      throw new Error('Cannot delete item group that is already used by items');
    }

    await db.query(
      'DELETE FROM item_groups WHERE institution_id = ? AND id = ?',
      [institutionId, groupId]
    );

    logger.info('Item group deleted', { groupId, institutionId, userId });
    return true;
  }

  async resolveItemGroupRef(institutionId, { itemGroupId = undefined, itemGroup = undefined } = {}) {
    if (itemGroupId === undefined && itemGroup === undefined) {
      return null;
    }

    const normalizedId = String(itemGroupId || '').trim();
    if (normalizedId) {
      const rows = await db.query(
        'SELECT id, name FROM item_groups WHERE institution_id = ? AND id = ? LIMIT 1',
        [institutionId, normalizedId]
      );
      if (rows.length === 0) {
        throw new Error('Selected item group was not found');
      }
      return {
        itemGroupId: rows[0].id,
        itemGroupName: rows[0].name
      };
    }

    const normalizedName = String(itemGroup || '').trim();
    if (!normalizedName) {
      return {
        itemGroupId: null,
        itemGroupName: null
      };
    }

    const rows = await db.query(
      'SELECT id, name FROM item_groups WHERE institution_id = ? AND name = ? LIMIT 1',
      [institutionId, normalizedName]
    );

    if (rows.length > 0) {
      return {
        itemGroupId: rows[0].id,
        itemGroupName: rows[0].name
      };
    }

    return {
      itemGroupId: null,
      itemGroupName: normalizedName
    };
  }
}

module.exports = new ItemGroupService();
