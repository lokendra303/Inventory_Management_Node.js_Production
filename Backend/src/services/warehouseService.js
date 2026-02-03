const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class WarehouseService {
  async createWarehouse(institutionId, warehouseData, userId) {
    const { code, name, type, address, contactPerson, phone, email } = warehouseData;

    const warehouseId = uuidv4();

    await db.query(
      `INSERT INTO warehouses (id, institution_id, code, name, type, address, contact_person, phone, email, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [warehouseId, institutionId, code, name, type || 'standard', address, contactPerson, phone, email]
    );

    logger.info('Warehouse created', { warehouseId, institutionId, code, userId });
    return warehouseId;
  }

  async updateWarehouse(institutionId, warehouseId, updateData, userId) {
    const {
      name,
      type,
      address,
      contactPerson,
      phone,
      email,
      capacityConstraints,
      status
    } = updateData;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (contactPerson !== undefined) {
      updateFields.push('contact_person = ?');
      updateValues.push(contactPerson);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (capacityConstraints !== undefined) {
      updateFields.push('capacity_constraints = ?');
      updateValues.push(JSON.stringify(capacityConstraints));
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(institutionId, warehouseId);

    const result = await db.query(
      `UPDATE warehouses SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('Warehouse not found');
    }

    logger.info('Warehouse updated', { warehouseId, institutionId, userId });
    return warehouseId;
  }

  async getWarehouse(institutionId, warehouseId) {
    if (!warehouseId) {
      return null;
    }
    
    const warehouses = await db.query(
      'SELECT * FROM warehouses WHERE institution_id = ? AND id = ?',
      [institutionId, warehouseId]
    );

    if (warehouses.length === 0) {
      return null;
    }

    const warehouse = warehouses[0];
    return {
      ...warehouse,
      capacity_constraints: JSON.parse(warehouse.capacity_constraints || '{}')
    };
  }

  async getWarehouseDetails(institutionId, warehouseId) {
    try {
      if (!warehouseId) {
        throw new Error('Warehouse ID is required');
      }
      
      // Get warehouse basic info
      const warehouses = await db.query(
        'SELECT * FROM warehouses WHERE institution_id = ? AND id = ?',
        [institutionId, warehouseId]
      );

      if (warehouses.length === 0) {
        throw new Error('Warehouse not found');
      }

      const warehouse = warehouses[0];

      // Get inventory summary
      const [inventorySummary] = await db.query(
        `SELECT 
           COUNT(DISTINCT ip.item_id) as total_items,
           SUM(ip.quantity_on_hand) as total_quantity,
           SUM(ip.total_value) as total_value,
           COUNT(CASE WHEN ip.quantity_on_hand <= 10 THEN 1 END) as low_stock_items
         FROM inventory_projections ip
         WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND ip.quantity_on_hand > 0`,
        [institutionId, warehouseId]
      );

      // Get items by category
      const itemsByCategory = await db.query(
        `SELECT 
           COALESCE(i.category, 'Uncategorized') as category,
           COUNT(ip.item_id) as item_count,
           SUM(ip.quantity_on_hand) as total_quantity,
           SUM(ip.total_value) as total_value
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND ip.quantity_on_hand > 0
         GROUP BY i.category
         ORDER BY total_value DESC`,
        [institutionId, warehouseId]
      );

      // Get top items by value
      const topItems = await db.query(
        `SELECT 
           i.sku, i.name, i.category, i.unit,
           ip.quantity_on_hand, ip.average_cost, ip.total_value
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND ip.quantity_on_hand > 0
         ORDER BY ip.total_value DESC
         LIMIT 20`,
        [institutionId, warehouseId]
      );

      return {
        ...warehouse,
        capacity_constraints: JSON.parse(warehouse.capacity_constraints || '{}'),
        summary: inventorySummary || {
          total_items: 0,
          total_quantity: 0,
          total_value: 0,
          low_stock_items: 0
        },
        categories: itemsByCategory,
        topItems
      };
    } catch (error) {
      logger.error('Failed to get warehouse details', { institutionId, warehouseId, error: error.message });
      throw error;
    }
  }

  async getWarehouses(institutionId, filters = {}) {
    let query = `SELECT w.*, COALESCE(wt.name, 'Standard') as type_name 
                 FROM warehouses w 
                 LEFT JOIN warehouse_types wt ON w.type = wt.id 
                 WHERE w.institution_id = ?`;
    const params = [institutionId];

    if (filters.status) {
      query += ' AND w.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY w.name';

    return await db.query(query, params);
  }

  async getWarehouseStats(institutionId, warehouseId) {
    const stats = await db.query(
      `SELECT 
         COUNT(DISTINCT ip.item_id) as total_items,
         SUM(ip.quantity_on_hand) as total_quantity,
         SUM(ip.total_value) as total_value,
         COUNT(CASE WHEN ip.quantity_available <= 10 THEN 1 END) as low_stock_items
       FROM inventory_projections ip
       WHERE ip.institution_id = ? AND ip.warehouse_id = ?`,
      [institutionId, warehouseId]
    );

    return stats[0] || {
      total_items: 0,
      total_quantity: 0,
      total_value: 0,
      low_stock_items: 0
    };
  }

  async getWarehouseCapacityUtilization(institutionId, warehouseId) {
    const warehouse = await this.getWarehouse(institutionId, warehouseId);
    if (!warehouse || !warehouse.capacity_constraints.maxItems) {
      return null;
    }

    const stats = await this.getWarehouseStats(institutionId, warehouseId);
    const utilizationPercentage = (stats.total_items / warehouse.capacity_constraints.maxItems) * 100;

    return {
      maxCapacity: warehouse.capacity_constraints.maxItems,
      currentItems: stats.total_items,
      utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
      availableCapacity: warehouse.capacity_constraints.maxItems - stats.total_items
    };
  }

  async checkWarehouseAccess(institutionId, userId, warehouseId) {
    // Get user's warehouse access
    const institution_users = await db.query(
      'SELECT warehouse_access, role FROM institution_users WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );

    if (institution_users.length === 0) {
      return false;
    }

    const user = institution_users[0];
    
    // Admin has access to all warehouses
    if (user.role === 'admin') {
      return true;
    }

    const warehouseAccess = JSON.parse(user.warehouse_access || '[]');
    
    // Empty array means access to all warehouses
    if (warehouseAccess.length === 0) {
      return true;
    }

    return warehouseAccess.includes(warehouseId);
  }

  async getUserWarehouses(institutionId, userId) {
    const institution_users = await db.query(
      'SELECT warehouse_access, role FROM institution_users WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );

    if (institution_users.length === 0) {
      return [];
    }

    const user = institution_users[0];
    
    // Admin has access to all warehouses
    if (user.role === 'admin') {
      return await this.getWarehouses(institutionId, { status: 'active' });
    }

    const warehouseAccess = JSON.parse(user.warehouse_access || '[]');
    
    // Empty array means access to all warehouses
    if (warehouseAccess.length === 0) {
      return await this.getWarehouses(institutionId, { status: 'active' });
    }

    // Get specific warehouses
    if (warehouseAccess.length > 0) {
      const placeholders = warehouseAccess.map(() => '?').join(',');
      const warehouses = await db.query(
        `SELECT * FROM warehouses 
         WHERE institution_id = ? AND id IN (${placeholders}) AND status = 'active'
         ORDER BY name`,
        [institutionId, ...warehouseAccess]
      );

      return warehouses.map(warehouse => ({
        ...warehouse,
        capacity_constraints: JSON.parse(warehouse.capacity_constraints || '{}')
      }));
    }

    return [];
  }

  async deleteWarehouse(institutionId, warehouseId, userId) {
    // Check if warehouse has any inventory
    const inventory = await db.query(
      'SELECT COUNT(*) as count FROM inventory_projections WHERE institution_id = ? AND warehouse_id = ? AND quantity_on_hand > 0',
      [institutionId, warehouseId]
    );

    if (inventory[0].count > 0) {
      throw new Error('Cannot delete warehouse with existing inventory');
    }

    // Soft delete
    const result = await db.query(
      'UPDATE warehouses SET status = "inactive", updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [institutionId, warehouseId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Warehouse not found');
    }

    logger.info('Warehouse deleted', { warehouseId, institutionId, userId });
    return true;
  }

  async getWarehouseMovements(institutionId, warehouseId, limit = 100, offset = 0) {
    // Get recent inventory movements for this warehouse
    const eventStore = require('../events/eventStore');
    
    const events = await db.query(
      `SELECT es.*, i.sku, i.name as item_name
       FROM event_store es
       JOIN items i ON JSON_EXTRACT(es.event_data, '$.itemId') = i.id
       WHERE es.institution_id = ? 
         AND JSON_EXTRACT(es.event_data, '$.warehouseId') = ?
         AND es.aggregate_type = 'inventory'
       ORDER BY es.created_at DESC
       LIMIT ? OFFSET ?`,
      [institutionId, warehouseId, limit, offset]
    );

    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data),
      metadata: JSON.parse(event.metadata || '{}')
    }));
  }
}

module.exports = new WarehouseService();