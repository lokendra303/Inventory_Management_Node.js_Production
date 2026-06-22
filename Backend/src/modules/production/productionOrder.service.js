const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const compositeInventoryService = require('../inventory/compositeInventory.service');
const logger = require('../../utils/logger');

class ProductionOrderService {
  async _generateOperationNumber(institutionId, operationType) {
    const prefix = operationType === 'disassemble' ? 'DSM' : 'ASM';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rows = await db.query(
      `SELECT COUNT(*) AS c
         FROM production_operations
        WHERE institution_id = ? AND operation_number LIKE ?`,
      [institutionId, `${prefix}-${date}-%`]
    );
    const seq = Number(rows[0]?.c || 0) + 1;
    return `${prefix}-${date}-${String(seq).padStart(4, '0')}`;
  }

  _parseJson(val, fallback = {}) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
  }

  _mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      operationNumber: row.operation_number,
      operationType: row.operation_type,
      status: row.status,
      compositeItemId: row.composite_item_id,
      warehouseId: row.warehouse_id,
      quantity: Number(row.quantity),
      notes: row.notes,
      payload: this._parseJson(row.payload_json),
      result: this._parseJson(row.result_json, null),
      batchRef: row.batch_ref,
      outputBatchNumber: row.output_batch_number,
      estimatedUnitCost: row.estimated_unit_cost != null ? Number(row.estimated_unit_cost) : null,
      createdBy: row.created_by,
      executedBy: row.executed_by,
      executedAt: row.executed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      kitName: row.kit_name,
      kitSku: row.kit_sku,
      warehouseName: row.warehouse_name,
      createdByName: row.created_by_name,
      executedByName: row.executed_by_name,
    };
  }

  _enrichAllocationRows(rows, itemMap) {
    if (!rows) return rows;
    const attach = (row) => {
      if (!row?.itemId || row.itemName) return row;
      const item = itemMap[row.itemId];
      if (!item) return row;
      return { ...row, itemName: item.name, itemSku: item.sku };
    };
    if (Array.isArray(rows)) return rows.map(attach);
    if (typeof rows === 'object') {
      return Object.fromEntries(
        Object.entries(rows).map(([key, value]) => {
          const list = Array.isArray(value) ? value : [value];
          return [key, list.map(attach)];
        })
      );
    }
    return rows;
  }

  async _enrichOrderResult(institutionId, order) {
    if (!order?.result || typeof order.result !== 'object') return order;

    const itemIds = new Set();
    const collectIds = (rows) => {
      if (!rows) return;
      const list = Array.isArray(rows) ? rows : Object.values(rows).flat();
      for (const row of list) {
        if (row?.itemId) itemIds.add(row.itemId);
      }
    };
    collectIds(order.result.componentBatchAllocations);
    collectIds(order.result.componentBatches);

    if (!itemIds.size) return order;

    const placeholders = [...itemIds].map(() => '?').join(', ');
    const itemRows = await db.query(
      `SELECT id, name, sku FROM items WHERE institution_id = ? AND id IN (${placeholders})`,
      [institutionId, ...itemIds]
    );
    const itemMap = Object.fromEntries(
      itemRows.map((row) => [row.id, { name: row.name, sku: row.sku }])
    );

    const result = { ...order.result };
    result.componentBatchAllocations = this._enrichAllocationRows(
      result.componentBatchAllocations,
      itemMap
    );
    result.componentBatches = this._enrichAllocationRows(result.componentBatches, itemMap);
    return { ...order, result };
  }

  async listOrders(institutionId, filters = {}) {
    const params = [institutionId];
    let sql = `
      SELECT po.*,
             i.name AS kit_name,
             i.sku AS kit_sku,
             w.name AS warehouse_name,
             CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, '')) AS created_by_name,
             CONCAT(COALESCE(eu.first_name, ''), ' ', COALESCE(eu.last_name, '')) AS executed_by_name
        FROM production_operations po
        JOIN items i ON i.id = po.composite_item_id AND i.institution_id = po.institution_id
        LEFT JOIN warehouses w ON w.id = po.warehouse_id AND w.institution_id = po.institution_id
        LEFT JOIN institution_users cu ON cu.id = po.created_by
        LEFT JOIN institution_users eu ON eu.id = po.executed_by
       WHERE po.institution_id = ?`;

    if (filters.status && filters.status !== 'all') {
      sql += ' AND po.status = ?';
      params.push(filters.status);
    }
    if (filters.operationType) {
      sql += ' AND po.operation_type = ?';
      params.push(filters.operationType);
    }
    if (filters.compositeItemId) {
      sql += ' AND po.composite_item_id = ?';
      params.push(filters.compositeItemId);
    }
    if (filters.search) {
      sql += ' AND (po.operation_number LIKE ? OR i.name LIKE ? OR i.sku LIKE ?)';
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }

    sql += ' ORDER BY po.created_at DESC';
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const offset = Math.max(Number(filters.offset) || 0, 0);
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const rows = await db.query(sql, params);
    return rows.map((row) => this._mapRow(row));
  }

  async getOrder(institutionId, orderId) {
    const rows = await db.query(
      `SELECT po.*,
              i.name AS kit_name,
              i.sku AS kit_sku,
              w.name AS warehouse_name,
              CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, '')) AS created_by_name,
              CONCAT(COALESCE(eu.first_name, ''), ' ', COALESCE(eu.last_name, '')) AS executed_by_name
         FROM production_operations po
         JOIN items i ON i.id = po.composite_item_id AND i.institution_id = po.institution_id
         LEFT JOIN warehouses w ON w.id = po.warehouse_id AND w.institution_id = po.institution_id
         LEFT JOIN institution_users cu ON cu.id = po.created_by
         LEFT JOIN institution_users eu ON eu.id = po.executed_by
        WHERE po.institution_id = ? AND po.id = ?
        LIMIT 1`,
      [institutionId, orderId]
    );
    if (!rows.length) return null;
    const order = this._mapRow(rows[0]);
    return this._enrichOrderResult(institutionId, order);
  }

  async saveDraft(institutionId, userId, body = {}) {
    const {
      id,
      operationType,
      compositeItemId,
      warehouseId,
      quantity,
      notes,
      payload,
      estimatedUnitCost,
      ...rest
    } = body;

    const payloadToStore = { ...(payload && typeof payload === 'object' ? payload : {}), ...rest };

    if (!['assemble', 'disassemble'].includes(String(operationType))) {
      throw new Error('operationType must be assemble or disassemble');
    }
    if (!compositeItemId || !warehouseId) {
      throw new Error('compositeItemId and warehouseId are required');
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('quantity must be a positive number');
    }

    if (id) {
      const existing = await this.getOrder(institutionId, id);
      if (!existing) throw new Error('Operation not found');
      if (existing.status !== 'draft') throw new Error('Only draft operations can be updated');

      await db.query(
        `UPDATE production_operations
            SET operation_type = ?, composite_item_id = ?, warehouse_id = ?, quantity = ?,
                notes = ?, payload_json = ?, estimated_unit_cost = ?, updated_at = NOW()
          WHERE institution_id = ? AND id = ? AND status = 'draft'`,
        [
          operationType,
          compositeItemId,
          warehouseId,
          qty,
          notes || null,
          JSON.stringify(payloadToStore),
          estimatedUnitCost != null ? Number(estimatedUnitCost) : null,
          institutionId,
          id,
        ]
      );
      return id;
    }

    const orderId = uuidv4();
    const operationNumber = await this._generateOperationNumber(institutionId, operationType);
    await db.query(
      `INSERT INTO production_operations
        (id, institution_id, operation_number, operation_type, status,
         composite_item_id, warehouse_id, quantity, notes, payload_json,
         estimated_unit_cost, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        institutionId,
        operationNumber,
        operationType,
        compositeItemId,
        warehouseId,
        qty,
        notes || null,
        JSON.stringify(payloadToStore),
        estimatedUnitCost != null ? Number(estimatedUnitCost) : null,
        userId,
      ]
    );
    return orderId;
  }

  async cancelDraft(institutionId, orderId, userId) {
    const existing = await this.getOrder(institutionId, orderId);
    if (!existing) throw new Error('Operation not found');
    if (existing.status !== 'draft') throw new Error('Only draft operations can be cancelled');

    await db.query(
      `UPDATE production_operations
          SET status = 'cancelled', executed_by = ?, executed_at = NOW(), updated_at = NOW()
        WHERE institution_id = ? AND id = ?`,
      [userId, institutionId, orderId]
    );
  }

  async confirmOrder(institutionId, orderId, userId) {
    const order = await this.getOrder(institutionId, orderId);
    if (!order) throw new Error('Operation not found');
    if (order.status !== 'draft') throw new Error('Only draft operations can be confirmed');

    const payload = {
      compositeItemId: order.compositeItemId,
      warehouseId: order.warehouseId,
      quantity: order.quantity,
      notes: order.notes,
      ...(order.payload || {}),
    };

    let result;
    if (order.operationType === 'assemble') {
      result = await compositeInventoryService.assembleKit(institutionId, payload, userId);
    } else {
      result = await compositeInventoryService.disassembleKit(institutionId, payload, userId);
    }

    const outputBatch = result.outputBatchNumber
      || (result.componentBatches?.[0]?.batchNumber)
      || null;

    await db.query(
      `UPDATE production_operations
          SET status = 'done',
              result_json = ?,
              batch_ref = ?,
              output_batch_number = ?,
              executed_by = ?,
              executed_at = NOW(),
              updated_at = NOW()
        WHERE institution_id = ? AND id = ?`,
      [
        JSON.stringify(result || {}),
        result.batchRef || null,
        outputBatch,
        userId,
        institutionId,
        orderId,
      ]
    );

    logger.info('Production order executed', {
      institutionId,
      orderId,
      operationNumber: order.operationNumber,
      operationType: order.operationType,
      userId,
    });

    return {
      orderId,
      operationNumber: order.operationNumber,
      ...result,
    };
  }

  async executeImmediate(institutionId, userId, body = {}) {
    const {
      operationType,
      compositeItemId,
      warehouseId,
      quantity,
      notes,
      estimatedUnitCost,
      ...rest
    } = body;

    const orderId = await this.saveDraft(institutionId, userId, {
      operationType,
      compositeItemId,
      warehouseId,
      quantity,
      notes,
      payload: rest,
      estimatedUnitCost,
    });

    return this.confirmOrder(institutionId, orderId, userId);
  }

  async recordCompletedOperation(institutionId, userId, operationType, payload, result) {
    try {
      const orderId = uuidv4();
      const operationNumber = await this._generateOperationNumber(institutionId, operationType);
      const outputBatch = result?.outputBatchNumber
        || result?.componentBatches?.[0]?.batchNumber
        || null;

      const {
        compositeItemId,
        warehouseId,
        quantity,
        notes,
        ...payloadRest
      } = payload;

      await db.query(
        `INSERT INTO production_operations
          (id, institution_id, operation_number, operation_type, status,
           composite_item_id, warehouse_id, quantity, notes, payload_json, result_json,
           batch_ref, output_batch_number, created_by, executed_by, executed_at)
         VALUES (?, ?, ?, ?, 'done', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderId,
          institutionId,
          operationNumber,
          operationType,
          compositeItemId,
          warehouseId,
          Number(quantity),
          notes || null,
          JSON.stringify(payloadRest || {}),
          JSON.stringify(result || {}),
          result?.batchRef || null,
          outputBatch,
          userId,
          userId,
        ]
      );
      return { orderId, operationNumber };
    } catch (err) {
      logger.warn('Failed to record production order audit row', {
        institutionId,
        error: err.message,
      });
      return null;
    }
  }
}

module.exports = new ProductionOrderService();
