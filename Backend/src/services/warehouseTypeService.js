const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class WarehouseTypeService {
  async createWarehouseType(institutionId, typeData, userId) {
    const { name, description } = typeData;
    const typeId = uuidv4();

    await db.query(
      `INSERT INTO warehouse_types (id, institution_id, name, description, status) 
       VALUES (?, ?, ?, ?, 'active')`,
      [typeId, institutionId, name, description]
    );

    logger.info('Warehouse type created', { typeId, institutionId, name, userId });
    return typeId;
  }

  async getWarehouseTypes(institutionId, filters = {}) {
    let query = 'SELECT * FROM warehouse_types WHERE institution_id = ?';
    const params = [institutionId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY name';

    return await db.query(query, params);
  }

  async updateWarehouseType(institutionId, typeId, updateData, userId) {
    const { name, description, status } = updateData;
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(institutionId, typeId);

    const result = await db.query(
      `UPDATE warehouse_types SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('Warehouse type not found');
    }

    logger.info('Warehouse type updated', { typeId, institutionId, userId });
    return typeId;
  }
}

module.exports = new WarehouseTypeService();