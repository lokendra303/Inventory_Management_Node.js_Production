const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');

class ProductionService {
  async getAvailabilitySummary(institutionId, orderId) {
    const order = await this.getOrderOrThrow(institutionId, orderId);
    const plannedQty = Number(order.planned_quantity || 0);
    const completedQty = Number(order.actual_quantity || 0);
    const remainingQty = Math.max(0, plannedQty - completedQty);

    const lines = await db.query(
      `SELECT pom.component_item_id, i.name as component_name, pom.quantity_planned, pom.quantity_issued
       FROM production_order_materials pom
       JOIN items i ON i.id = pom.component_item_id
       WHERE pom.institution_id = ? AND pom.order_id = ?`,
      [institutionId, orderId]
    );

    let maxProducible = Number.POSITIVE_INFINITY;
    const components = [];
    for (const line of lines) {
      const perUnit = plannedQty > 0 ? Number(line.quantity_planned || 0) / plannedQty : 0;
      const requiredForRemaining = perUnit * remainingQty;

      const stock = await db.query(
        `SELECT quantity_available
         FROM inventory_projections
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
        [institutionId, line.component_item_id, order.warehouse_id]
      );
      const available = Number(stock[0]?.quantity_available || 0);
      const shortage = Math.max(0, requiredForRemaining - available);
      const possibleByLine = perUnit > 0 ? (available / perUnit) : Number.POSITIVE_INFINITY;
      maxProducible = Math.min(maxProducible, possibleByLine);

      components.push({
        componentItemId: line.component_item_id,
        componentName: line.component_name,
        perUnitRequirement: Number(perUnit.toFixed(6)),
        requiredForRemaining: Number(requiredForRemaining.toFixed(4)),
        availableQuantity: Number(available.toFixed(4)),
        shortageQuantity: Number(shortage.toFixed(4))
      });
    }

    if (!Number.isFinite(maxProducible)) maxProducible = 0;
    const maxCompletableNow = Math.max(0, Math.min(remainingQty, maxProducible));
    const isFullyAvailable = components.every((c) => c.shortageQuantity <= 0);

    return {
      orderId,
      warehouseId: order.warehouse_id,
      plannedQuantity: plannedQty,
      completedQuantity: completedQty,
      remainingQuantity: Number(remainingQty.toFixed(4)),
      maxCompletableNow: Number(maxCompletableNow.toFixed(4)),
      isFullyAvailable,
      components
    };
  }

  async createMaster(institutionId, data, userId) {
    const {
      productionItemId,
      defaultWarehouseId = null,
      title = null,
      tagline = null,
      status = 'draft'
    } = data || {};

    if (!productionItemId) throw new Error('productionItemId is required');

    const itemRows = await db.query(
      'SELECT id FROM items WHERE institution_id = ? AND id = ?',
      [institutionId, productionItemId]
    );
    if (itemRows.length === 0) throw new Error('Production item not found');

    const masterId = uuidv4();
    await db.query(
      `INSERT INTO production_masters
       (id, institution_id, production_item_id, default_warehouse_id, title, tagline, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [masterId, institutionId, productionItemId, defaultWarehouseId, title, tagline, status, userId, userId]
    );

    await this.writeAudit(institutionId, 'production_master', masterId, 'created', { status }, userId);
    return masterId;
  }

  async createBomVersion(institutionId, masterId, data, userId) {
    const { outputQuantity, status = 'draft', effectiveFrom = null, effectiveTo = null, notes = null, lines = [] } = data || {};
    if (!outputQuantity || Number(outputQuantity) <= 0) throw new Error('outputQuantity must be > 0');
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('At least one BOM line is required');

    return db.transaction(async (connection) => {
      const [masterRows] = await connection.execute(
        'SELECT id FROM production_masters WHERE institution_id = ? AND id = ?',
        [institutionId, masterId]
      );
      if (masterRows.length === 0) throw new Error('Production master not found');

      const [versionRows] = await connection.execute(
        'SELECT COALESCE(MAX(version_no), 0) as lastVersion FROM production_bom_versions WHERE institution_id = ? AND master_id = ?',
        [institutionId, masterId]
      );
      const nextVersion = Number(versionRows[0].lastVersion || 0) + 1;
      const bomVersionId = uuidv4();

      await connection.execute(
        `INSERT INTO production_bom_versions
         (id, institution_id, master_id, version_no, output_quantity, status, effective_from, effective_to, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bomVersionId, institutionId, masterId, nextVersion, outputQuantity, status, effectiveFrom, effectiveTo, notes, userId]
      );

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.componentItemId || Number(line.quantityRequired) <= 0) {
          throw new Error(`Invalid BOM line at position ${i + 1}`);
        }
        await connection.execute(
          `INSERT INTO production_bom_lines
           (id, institution_id, bom_version_id, component_item_id, quantity_required, wastage_percent, sequence_no)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            institutionId,
            bomVersionId,
            line.componentItemId,
            Number(line.quantityRequired),
            Number(line.wastagePercent || 0),
            Number(line.sequenceNo || i + 1)
          ]
        );
      }

      await this.writeAudit(institutionId, 'production_bom_version', bomVersionId, 'created', { version: nextVersion }, userId, connection);
      return bomVersionId;
    });
  }

  async createOrder(institutionId, data, userId) {
    const { masterId, bomVersionId, warehouseId, plannedQuantity, processCostTotal = 0 } = data || {};
    if (!masterId || !warehouseId) throw new Error('masterId and warehouseId are required');
    if (!plannedQuantity || Number(plannedQuantity) <= 0) throw new Error('plannedQuantity must be > 0');

    return db.transaction(async (connection) => {
      const [masterRows] = await connection.execute(
        `SELECT pm.id, pm.production_item_id
         FROM production_masters pm
         WHERE pm.institution_id = ? AND pm.id = ? AND pm.status = 'active'`,
        [institutionId, masterId]
      );
      if (!masterRows.length) throw new Error('Active production master not found');
      const productionItemId = masterRows[0].production_item_id;

      let selectedBomId = bomVersionId || null;
      if (!selectedBomId) {
        const [activeRows] = await connection.execute(
          `SELECT id
           FROM production_bom_versions
           WHERE institution_id = ? AND master_id = ? AND status = 'active'
           ORDER BY version_no DESC
           LIMIT 1`,
          [institutionId, masterId]
        );
        if (!activeRows.length) throw new Error('No active BOM found for selected master');
        selectedBomId = activeRows[0].id;
      }

      const [bomRows] = await connection.execute(
        `SELECT id, output_quantity, status
         FROM production_bom_versions
         WHERE institution_id = ? AND id = ? AND master_id = ?`,
        [institutionId, selectedBomId, masterId]
      );
      if (!bomRows.length) throw new Error('BOM version not found');
      if (bomRows[0].status !== 'active') throw new Error('Only active BOM versions can be used');

      const [lineRows] = await connection.execute(
        `SELECT component_item_id, quantity_required, wastage_percent
         FROM production_bom_lines
         WHERE institution_id = ? AND bom_version_id = ?
         ORDER BY sequence_no ASC`,
        [institutionId, selectedBomId]
      );
      if (!lineRows.length) throw new Error('BOM has no lines');

      const outputQty = Number(bomRows[0].output_quantity);
      const scaleFactor = Number(plannedQuantity) / outputQty;

      const orderId = uuidv4();
      const orderNumber = await this.generateOrderNumber(institutionId, connection);
      await connection.execute(
        `INSERT INTO production_orders
         (id, institution_id, master_id, bom_version_id, production_item_id, warehouse_id, order_number, planned_quantity, process_cost_total, status, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [orderId, institutionId, masterId, selectedBomId, productionItemId, warehouseId, orderNumber, Number(plannedQuantity), Number(processCostTotal), userId, userId]
      );

      for (const line of lineRows) {
        const planned = Number(line.quantity_required) * scaleFactor * (1 + (Number(line.wastage_percent || 0) / 100));
        await connection.execute(
          `INSERT INTO production_order_materials
           (id, institution_id, order_id, component_item_id, quantity_planned)
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), institutionId, orderId, line.component_item_id, planned]
        );
      }

      await this.writeAudit(institutionId, 'production_order', orderId, 'created', { plannedQuantity: Number(plannedQuantity) }, userId, connection);
      return { orderId, orderNumber, bomVersionId: selectedBomId };
    });
  }

  async checkAvailability(institutionId, orderId) {
    const summary = await this.getAvailabilitySummary(institutionId, orderId);

    await db.query(
      `UPDATE production_orders
       SET availability_checked_at = NOW(),
           status = CASE WHEN ? = 1 AND status = 'draft' THEN 'released' ELSE status END,
           updated_at = NOW()
       WHERE institution_id = ? AND id = ?`,
      [summary.isFullyAvailable ? 1 : 0, institutionId, orderId]
    );

    return summary;
  }

  async completeOrder(institutionId, orderId, payload, userId) {
    const completionQty = Number(payload?.actualQuantity || 0);
    const processCostTotal = Number(payload?.processCostTotal || 0);
    if (completionQty <= 0) throw new Error('actualQuantity must be > 0');

    return db.transaction(async (connection) => {
      const [orderRows] = await connection.execute(
        `SELECT * FROM production_orders WHERE institution_id = ? AND id = ? FOR UPDATE`,
        [institutionId, orderId]
      );
      if (!orderRows.length) throw new Error('Production order not found');
      const order = orderRows[0];
      if (order.status === 'completed') throw new Error('Order already completed');
      if (order.status === 'cancelled') throw new Error('Cancelled order cannot be completed');
      const plannedQty = Number(order.planned_quantity || 0);
      const alreadyCompleted = Number(order.actual_quantity || 0);
      const remainingQty = Math.max(0, plannedQty - alreadyCompleted);
      if (completionQty > remainingQty) throw new Error(`Completion quantity cannot exceed remaining quantity (${remainingQty})`);

      const [lineRows] = await connection.execute(
        `SELECT * FROM production_order_materials WHERE institution_id = ? AND order_id = ? FOR UPDATE`,
        [institutionId, orderId]
      );
      if (!lineRows.length) throw new Error('Order has no material lines');

      const factor = completionQty / plannedQty;
      let materialTotal = 0;

      for (const line of lineRows) {
        const issueQty = Number(line.quantity_planned) * factor;
        const [stockRows] = await connection.execute(
          `SELECT * FROM inventory_projections
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?
           FOR UPDATE`,
          [institutionId, line.component_item_id, order.warehouse_id]
        );
        if (!stockRows.length) throw new Error(`No stock projection found for component ${line.component_item_id}`);
        const s = stockRows[0];
        if (Number(s.quantity_available) < issueQty || Number(s.quantity_on_hand) < issueQty) {
          throw new Error(`Insufficient stock for component ${line.component_item_id}`);
        }

        const unitCost = Number(s.average_cost || 0);
        const lineCost = issueQty * unitCost;
        materialTotal += lineCost;

        const newOnHand = Number(s.quantity_on_hand) - issueQty;
        const newAvailable = Number(s.quantity_available) - issueQty;
        const newTotalValue = newOnHand * unitCost;

        await connection.execute(
          `UPDATE inventory_projections
           SET quantity_on_hand = ?, quantity_available = ?, total_value = ?, last_movement_date = NOW(), version = version + 1
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
          [newOnHand, newAvailable, newTotalValue, institutionId, line.component_item_id, order.warehouse_id]
        );

        await connection.execute(
          `UPDATE production_order_materials
           SET quantity_issued = ?, unit_cost = ?, line_cost = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            Number(line.quantity_issued || 0) + issueQty,
            unitCost,
            Number(line.line_cost || 0) + lineCost,
            line.id
          ]
        );
      }

      const totalCost = materialTotal + processCostTotal;
      const fgUnitCost = totalCost / completionQty;

      const [fgProjectionRows] = await connection.execute(
        `SELECT * FROM inventory_projections
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?
         FOR UPDATE`,
        [institutionId, order.production_item_id, order.warehouse_id]
      );

      if (!fgProjectionRows.length) {
        await connection.execute(
          `INSERT INTO inventory_projections
           (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_reserved, quantity_available, average_cost, total_value, last_movement_date, version)
           VALUES (UUID(), ?, ?, ?, ?, 0, ?, ?, ?, NOW(), 1)`,
          [institutionId, order.production_item_id, order.warehouse_id, completionQty, completionQty, fgUnitCost, totalCost]
        );
      } else {
        const fg = fgProjectionRows[0];
        const prevQty = Number(fg.quantity_on_hand);
        const prevAvg = Number(fg.average_cost || 0);
        const newQty = prevQty + completionQty;
        const newTotalValue = (prevQty * prevAvg) + totalCost;
        const newAvgCost = newQty > 0 ? (newTotalValue / newQty) : 0;
        const newAvailable = Number(fg.quantity_available) + completionQty;

        await connection.execute(
          `UPDATE inventory_projections
           SET quantity_on_hand = ?, quantity_available = ?, average_cost = ?, total_value = ?, last_movement_date = NOW(), version = version + 1
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
          [newQty, newAvailable, newAvgCost, newTotalValue, institutionId, order.production_item_id, order.warehouse_id]
        );
      }

      const newCompletedQty = alreadyCompleted + completionQty;
      const nextStatus = newCompletedQty >= plannedQty ? 'completed' : 'in_progress';
      await connection.execute(
        `UPDATE production_orders
         SET actual_quantity = ?, process_cost_total = ?, material_cost_total = ?, total_cost = ?, status = ?,
             completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END, updated_by = ?, updated_at = NOW()
         WHERE institution_id = ? AND id = ?`,
        [
          newCompletedQty,
          Number(order.process_cost_total || 0) + processCostTotal,
          Number(order.material_cost_total || 0) + materialTotal,
          Number(order.total_cost || 0) + totalCost,
          nextStatus,
          nextStatus,
          userId,
          institutionId,
          orderId
        ]
      );

      await connection.execute(
        `INSERT INTO production_receipts
         (id, institution_id, order_id, received_quantity, unit_cost, total_cost, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), institutionId, orderId, completionQty, fgUnitCost, totalCost, userId]
      );

      await this.writeAudit(institutionId, 'production_order', orderId, 'completed', {
        actualQuantity: completionQty,
        processCostTotal,
        materialCostTotal: materialTotal,
        totalCost,
        orderStatus: nextStatus
      }, userId, connection);

      return { orderId, actualQuantity: completionQty, unitCost: fgUnitCost, totalCost, orderStatus: nextStatus };
    });
  }

  async listMasters(institutionId, filters = {}) {
    let query = `
      SELECT pm.*, i.name as production_item_name, i.sku as production_item_sku,
             (
               SELECT pbv.id
               FROM production_bom_versions pbv
               WHERE pbv.institution_id = pm.institution_id
                 AND pbv.master_id = pm.id
                 AND pbv.status = 'active'
               ORDER BY pbv.version_no DESC
               LIMIT 1
             ) as active_bom_version_id
      FROM production_masters pm
      JOIN items i ON i.id = pm.production_item_id
      WHERE pm.institution_id = ?`;
    const params = [institutionId];

    if (filters.status) {
      query += ' AND pm.status = ?';
      params.push(filters.status);
    }
    query += ' ORDER BY pm.created_at DESC';
    return db.query(query, params);
  }

  async listOrders(institutionId, filters = {}) {
    let query = `
      SELECT po.*, i.name as production_item_name, i.sku as production_item_sku
      FROM production_orders po
      JOIN items i ON i.id = po.production_item_id
      WHERE po.institution_id = ?`;
    const params = [institutionId];
    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }
    query += ' ORDER BY po.created_at DESC';
    return db.query(query, params);
  }

  async getOrderOrThrow(institutionId, orderId) {
    const rows = await db.query(
      'SELECT * FROM production_orders WHERE institution_id = ? AND id = ?',
      [institutionId, orderId]
    );
    if (!rows.length) throw new Error('Production order not found');
    return rows[0];
  }

  async generateOrderNumber(institutionId, connection) {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as total
       FROM production_orders
       WHERE institution_id = ?`,
      [institutionId]
    );
    const seq = Number(rows[0]?.total || 0) + 1;
    return `PROD-${String(seq).padStart(6, '0')}`;
  }

  async writeAudit(institutionId, entityType, entityId, action, payload, userId, connection = null) {
    const runner = connection || db;
    if (typeof runner.execute === 'function') {
      await runner.execute(
        `INSERT INTO production_audit_logs
         (id, institution_id, entity_type, entity_id, action, payload, performed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), institutionId, entityType, entityId, action, JSON.stringify(payload || {}), userId]
      );
      return;
    }
    await runner.query(
      `INSERT INTO production_audit_logs
       (id, institution_id, entity_type, entity_id, action, payload, performed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), institutionId, entityType, entityId, action, JSON.stringify(payload || {}), userId]
    );
  }
}

module.exports = new ProductionService();
