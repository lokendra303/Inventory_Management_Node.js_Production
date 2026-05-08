const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const { roundToTwo } = require('../../utils/precision');

const RESERVED_WAREHOUSE_CODES = new Set([
  'accessibleroutes'
]);

class WarehouseService {
  parseJsonObject(raw, fallback = {}) {
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return fallback;
      if (!trimmed.startsWith('{')) return fallback;
      try {
        const parsed = JSON.parse(trimmed);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
      } catch (_) {
        return fallback;
      }
    }
    return fallback;
  }

  parseWarehouseAccess(raw) {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
          if (typeof parsed === 'string' && parsed) return [parsed];
        } catch (_) {
          // fall through to legacy parsing
        }
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
      }
      return [trimmed];
    }

    return [];
  }

  normalizeWarehouseCode(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
  }

  async ensureUniqueWarehouseCode(institutionId, requestedCode, warehouseName) {
    let baseCode = this.normalizeWarehouseCode(requestedCode);

    // Defensive fallback: some malformed payloads have leaked route keys as code.
    if (!baseCode || RESERVED_WAREHOUSE_CODES.has(baseCode.toLowerCase())) {
      const fromName = this.normalizeWarehouseCode(warehouseName)
        .replace(/_/g, '')
        .replace(/-/g, '')
        .slice(0, 12);
      baseCode = fromName || `WH${Date.now().toString().slice(-6)}`;
    }

    baseCode = baseCode.slice(0, 50);
    let candidate = baseCode;
    let suffix = 1;

    // Keep incrementing suffix until we find a tenant-unique code.
    while (true) {
      const existing = await db.query(
        'SELECT id FROM warehouses WHERE institution_id = ? AND code = ? LIMIT 1',
        [institutionId, candidate]
      );
      if (existing.length === 0) return candidate;

      const maxBaseLength = 50 - (`-${suffix}`.length);
      candidate = `${baseCode.slice(0, Math.max(1, maxBaseLength))}-${suffix}`;
      suffix += 1;
    }
  }

  async resolveWarehouseTypeId(institutionId, typeId) {
    if (!typeId) return null;

    const rows = await db.query(
      'SELECT id FROM warehouse_types WHERE institution_id = ? AND id = ? LIMIT 1',
      [institutionId, typeId]
    );

    return rows.length > 0 ? typeId : null;
  }

  async createWarehouse(institutionId, warehouseData, userId) {
    const { code, name, type, address, contactPerson, phone, email } = warehouseData;

    const resolvedCode = await this.ensureUniqueWarehouseCode(institutionId, code, name);
    const resolvedType = await this.resolveWarehouseTypeId(institutionId, type);
    const warehouseId = uuidv4();

    await db.query(
      `INSERT INTO warehouses (id, institution_id, code, name, type, address, contact_person, phone, email, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [warehouseId, institutionId, resolvedCode, name, resolvedType, address, contactPerson, phone, email, userId || null]
    );

    logger.info('Warehouse created', { warehouseId, institutionId, code: resolvedCode, userId });
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
    updateFields.push('updated_by = ?');
    updateValues.push(userId || null);

    const result = await db.query(
      `UPDATE warehouses SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      [...updateValues, institutionId, warehouseId]
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
      capacity_constraints: this.parseJsonObject(warehouse.capacity_constraints, {})
    };
  }

  async getWarehouseDetails(institutionId, warehouseId) {
    try {
      if (!warehouseId) {
        throw new Error('Warehouse ID is required');
      }
      
      // Warehouse row + creator / last editor display names from institution_users
      const warehouses = await db.query(
        `SELECT w.*,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', cu.first_name, cu.last_name)), ''),
              cu.email,
              CAST(w.created_by AS CHAR)
            ) AS created_by_display,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', uu.first_name, uu.last_name)), ''),
              uu.email,
              CAST(w.updated_by AS CHAR)
            ) AS updated_by_display
         FROM warehouses w
         LEFT JOIN institution_users cu ON cu.id = w.created_by AND cu.institution_id = w.institution_id
         LEFT JOIN institution_users uu ON uu.id = w.updated_by AND uu.institution_id = w.institution_id
         WHERE w.institution_id = ? AND w.id = ?`,
        [institutionId, warehouseId]
      );

      if (warehouses.length === 0) {
        throw new Error('Warehouse not found');
      }

      const row = warehouses[0];
      const {
        created_by_display: createdByName,
        updated_by_display: updatedByName,
        ...warehouse
      } = row;

      // Get inventory summary
      const [inventorySummary] = await db.query(
        `SELECT 
           COUNT(DISTINCT ip.item_id) as total_items,
           SUM(ip.quantity_on_hand) as total_quantity,
           SUM(ip.quantity_available) as total_available,
           SUM(ip.quantity_reserved) as total_reserved,
           SUM(ip.total_value) as total_value,
           COUNT(CASE WHEN ip.quantity_on_hand <= 10 THEN 1 END) as low_stock_items
         FROM inventory_projections ip
         WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND ip.quantity_on_hand > 0`,
        [institutionId, warehouseId]
      );

      // Round values for precision, handle null values
      const summary = {
        total_items: inventorySummary?.total_items || 0,
        total_quantity: roundToTwo(parseFloat(inventorySummary?.total_quantity) || 0),
        total_available: roundToTwo(parseFloat(inventorySummary?.total_available) || 0),
        total_reserved: roundToTwo(parseFloat(inventorySummary?.total_reserved) || 0),
        total_value: roundToTwo(parseFloat(inventorySummary?.total_value) || 0),
        low_stock_items: inventorySummary?.low_stock_items || 0
      };

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

      // Round values for precision, handle null values
      itemsByCategory.forEach(cat => {
        cat.total_quantity = roundToTwo(parseFloat(cat.total_quantity) || 0);
        cat.total_value = roundToTwo(parseFloat(cat.total_value) || 0);
      });

      // Get top items by value
      const topItems = await db.query(
        `SELECT 
           i.sku, i.name, i.category, 
           COALESCE(u.name, i.unit, 'N/A') as unit,
           ip.quantity_on_hand, ip.average_cost, ip.total_value
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         LEFT JOIN units u ON CAST(i.unit AS CHAR) = CAST(u.id AS CHAR)
         WHERE ip.institution_id = ? AND ip.warehouse_id = ? AND ip.quantity_on_hand > 0
         ORDER BY ip.total_value DESC
         LIMIT 20`,
        [institutionId, warehouseId]
      );

      // Round values for precision, handle null values
      topItems.forEach(item => {
        item.quantity_on_hand = roundToTwo(parseFloat(item.quantity_on_hand) || 0);
        item.average_cost = roundToTwo(parseFloat(item.average_cost) || 0);
        item.total_value = roundToTwo(parseFloat(item.total_value) || 0);
      });

      return {
        ...warehouse,
        capacity_constraints: this.parseJsonObject(warehouse.capacity_constraints, {}),
        created_by_name: createdByName || null,
        updated_by_name: updatedByName || null,
        summary,
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

    if (filters.status === 'all') {
      // no status filter — return everything
    } else {
      query += ' AND w.status = ?';
      params.push(filters.status || 'active');
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

    const warehouseAccess = this.parseWarehouseAccess(user.warehouse_access);
    
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
    
    // Admin has access to all active warehouses
    if (user.role === 'admin') {
      return await this.getWarehouses(institutionId, { status: 'active' });
    }

    const warehouseAccess = this.parseWarehouseAccess(user.warehouse_access);
    
    // Empty array means access to all active warehouses
    if (warehouseAccess.length === 0) {
      return await this.getWarehouses(institutionId, { status: 'active' });
    }

    // Get specific active warehouses only
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
        capacity_constraints: this.parseJsonObject(warehouse.capacity_constraints, {})
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
      event_data: this.parseJsonObject(event.event_data, {}),
      metadata: this.parseJsonObject(event.metadata, {})
    }));
  }
}

module.exports = new WarehouseService();