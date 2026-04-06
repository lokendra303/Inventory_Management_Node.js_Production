const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const auditLogService = require('../audit/auditLog.service');

class PurchaseOrderService {
  async createPurchaseOrder(institutionId, poData, userId) {
    const {
      poNumber,
      vendorId,
      vendorName,
      currency = 'USD',
      exchangeRate = 1.0,
      orderDate,
      expectedDate,
      notes,
      lines
    } = poData;

    const poId = uuidv4();
    let subtotal = 0;

    try {
      await db.transaction(async (connection) => {
        if (!institutionId) throw new Error('institutionId is required');
        if (!poNumber) throw new Error('poNumber is required');
        if (!vendorName) throw new Error('vendorName is required');
        
        let formattedOrderDate = orderDate;
        let formattedExpectedDate = expectedDate;
        
        if (!orderDate || typeof orderDate === 'object' || orderDate === '{}') {
          formattedOrderDate = new Date().toISOString().split('T')[0];
        } else if (orderDate instanceof Date) {
          formattedOrderDate = orderDate.toISOString().split('T')[0];
        } else if (typeof orderDate === 'string' && orderDate.trim()) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(orderDate)) {
            throw new Error('orderDate must be in YYYY-MM-DD format');
          }
          formattedOrderDate = orderDate;
        } else {
          formattedOrderDate = new Date().toISOString().split('T')[0];
        }
        
        if (expectedDate && typeof expectedDate === 'object' && expectedDate !== null) {
          formattedExpectedDate = null;
        } else if (expectedDate instanceof Date) {
          formattedExpectedDate = expectedDate.toISOString().split('T')[0];
        } else if (typeof expectedDate === 'string' && expectedDate.trim()) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(expectedDate)) {
            formattedExpectedDate = null;
          } else {
            formattedExpectedDate = expectedDate;
          }
        }
        
        const createdBy = userId || null;
        
        await connection.execute(
          `INSERT INTO purchase_orders 
           (id, institution_id, po_number, vendor_id, vendor_name, currency, exchange_rate, 
            order_date, expected_date, notes, created_by, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [poId, institutionId, poNumber, vendorId || null, vendorName, currency, exchangeRate, 
           formattedOrderDate, formattedExpectedDate, notes || null, createdBy]
        );

        const effectiveExchangeRate = parseFloat(exchangeRate) || 1.0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.warehouseId) {
            throw new Error('Warehouse is required for each line item');
          }
          
          const lineId = uuidv4();
          // unit_cost stored in PO currency; line_total converted to base currency
          const lineTotalForeign = Math.round(line.quantity * line.unitCost * 100) / 100;
          const lineTotal = Math.round(lineTotalForeign * effectiveExchangeRate * 100) / 100;
          const discountRate = line.discountRate || 0;
          const taxRate = line.taxRate || 0;
          const discountAmount = Math.round((lineTotal * discountRate) / 100 * 100) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = Math.round((taxableAmount * taxRate) / 100 * 100) / 100;
          subtotal += lineTotal;

          let lineExpectedDate = line.expectedDate || formattedExpectedDate || null;
          if (lineExpectedDate && typeof lineExpectedDate === 'object') {
            lineExpectedDate = null;
          }
          
          await connection.execute(
            `INSERT INTO purchase_order_lines 
             (id, institution_id, po_id, item_id, warehouse_id, line_number, quantity_ordered, unit_cost, line_total, tax_rate, tax_amount, discount_rate, discount_amount, expected_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, institutionId, poId, line.itemId, line.warehouseId, i + 1, line.quantity, line.unitCost, lineTotal, taxRate, taxAmount, discountRate, discountAmount, lineExpectedDate]
          );
        }

        await connection.execute(
          'UPDATE purchase_orders SET subtotal = ?, total_amount = ? WHERE id = ?',
          [subtotal, subtotal, poId]
        );
      });

      logger.info('Multi-warehouse purchase order created', { poId, institutionId, poNumber, userId });
      return poId;
    } catch (error) {
      logger.error('Failed to create purchase order', { institutionId, poNumber, error: error.message });
      throw error;
    }
  }

  async createGRN(institutionId, grnData, userId) {
    const { grnNumber, poId, receiptDate, lines, notes } = grnData;

    if (!institutionId) throw new Error('institutionId is required');
    if (!poId) throw new Error(`poId is required. Received: ${poId}`);
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      throw new Error('lines array is required and must not be empty');
    }

    let formattedReceiptDate = receiptDate;
    if (!receiptDate || typeof receiptDate === 'object' || receiptDate === '{}') {
      formattedReceiptDate = new Date().toISOString().split('T')[0];
    } else if (receiptDate instanceof Date) {
      formattedReceiptDate = receiptDate.toISOString().split('T')[0];
    } else if (typeof receiptDate === 'string' && receiptDate.trim()) {
      formattedReceiptDate = receiptDate;
    } else {
      formattedReceiptDate = new Date().toISOString().split('T')[0];
    }

    const receivedBy = userId || null;
    const grnId = uuidv4();
    const resolvedGrnNumber = grnNumber || `GRN-${Date.now()}`;

    try {
      await db.transaction(async (connection) => {
        await connection.execute(
          `INSERT INTO goods_receipt_notes 
           (id, institution_id, grn_number, po_id, receipt_date, received_by, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [grnId, institutionId, resolvedGrnNumber, poId, formattedReceiptDate, receivedBy, notes || null]
        );

        for (const line of lines) {
          if (!line.itemId) throw new Error('line.itemId is required');
          if (!line.poLineId) throw new Error('line.poLineId is required');
          if (!line.warehouseId) throw new Error('line.warehouseId is required');
          if (line.quantityReceived === undefined || line.quantityReceived === null) {
            throw new Error('line.quantityReceived is required');
          }
          if (line.unitCost === undefined || line.unitCost === null) {
            throw new Error('line.unitCost is required');
          }

          // FIX #2: Lock PO line row to prevent race condition on concurrent GRN submissions
          // FIX #2: Also validate GRN warehouse matches PO line warehouse
          const [poLineResult] = await connection.execute(
            'SELECT quantity_ordered, quantity_received, warehouse_id FROM purchase_order_lines WHERE id = ? FOR UPDATE',
            [line.poLineId]
          );
          if (poLineResult.length === 0) throw new Error(`PO line ${line.poLineId} not found`);

          // FIX #2: Enforce warehouse consistency — GRN must receive into the same warehouse as ordered
          if (poLineResult[0].warehouse_id && poLineResult[0].warehouse_id !== line.warehouseId) {
            throw new Error(
              `Warehouse mismatch on PO line ${line.poLineId}: ordered for warehouse ${poLineResult[0].warehouse_id}, but GRN specifies ${line.warehouseId}`
            );
          }

          const pending = Number(poLineResult[0].quantity_ordered) - Number(poLineResult[0].quantity_received);
          if (Number(line.quantityReceived) > pending) {
            throw new Error(`Cannot receive ${line.quantityReceived} units — only ${pending} units pending for item`);
          }

          const grnLineId = uuidv4();
          const lineTotal = Math.round(line.quantityReceived * line.unitCost * 100) / 100;

          await connection.execute(
            `INSERT INTO grn_lines 
             (id, institution_id, grn_id, po_line_id, item_id, warehouse_id, quantity_received, unit_cost, line_total, quality_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [grnLineId, institutionId, grnId, line.poLineId, line.itemId, line.warehouseId, line.quantityReceived, line.unitCost, lineTotal, line.qualityStatus || 'accepted']
          );

          // Only update PO line received qty for accepted items
          if (line.qualityStatus !== 'rejected') {
            await connection.execute(
              `UPDATE purchase_order_lines 
               SET quantity_received = quantity_received + ?, 
                   status = CASE 
                     WHEN quantity_received + ? >= quantity_ordered THEN 'received'
                     WHEN quantity_received + ? > 0 THEN 'partially_received'
                     ELSE 'pending'
                   END,
                   updated_at = NOW()
               WHERE id = ?`,
              [line.quantityReceived, line.quantityReceived, line.quantityReceived, line.poLineId]
            );
          }

          // FIX #1: Update inventory INSIDE the transaction so GRN and stock are always in sync
          if (line.qualityStatus === 'accepted' || !line.qualityStatus) {
            const current = await connection.execute(
              'SELECT quantity_on_hand, quantity_available, average_cost FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
              [institutionId, line.itemId, line.warehouseId]
            );
            const qty = Number(line.quantityReceived);
            const cost = Number(line.unitCost);

            if (current[0].length === 0) {
              await connection.execute(
                `INSERT INTO inventory_projections 
                 (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available, quantity_reserved, average_cost, total_value, last_movement_date, version)
                 VALUES (UUID(), ?, ?, ?, ?, ?, 0, ?, ?, NOW(), 1)`,
                [institutionId, line.itemId, line.warehouseId, qty, qty, cost, qty * cost]
              );
            } else {
              const curr = current[0][0];
              const newQtyOnHand = Number(curr.quantity_on_hand) + qty;
              const newTotalValue = Number(curr.quantity_on_hand) * Number(curr.average_cost) + qty * cost;
              const newAvgCost = newTotalValue / newQtyOnHand;
              const newQtyAvailable = Number(curr.quantity_available) + qty;
              await connection.execute(
                `UPDATE inventory_projections 
                 SET quantity_on_hand = ?, quantity_available = ?, average_cost = ?, total_value = ?,
                     last_movement_date = NOW(), version = version + 1
                 WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
                [newQtyOnHand, newQtyAvailable, newAvgCost, newTotalValue, institutionId, line.itemId, line.warehouseId]
              );
            }

            // FIX #4: Use deterministic idempotency key (grnLineId) for event store
            await connection.execute(
              `INSERT IGNORE INTO event_store (id, institution_id, aggregate_type, aggregate_id, event_type, event_data, metadata, idempotency_key, created_by)
               VALUES (UUID(), ?, 'inventory', ?, 'PurchaseReceived', ?, ?, ?, ?)`,
              [
                institutionId,
                `${line.itemId}:${line.warehouseId}`,
                JSON.stringify({ itemId: line.itemId, warehouseId: line.warehouseId, quantity: qty, unitCost: cost, poId, poLineId: line.poLineId, grnNumber: resolvedGrnNumber, receivedDate: new Date().toISOString() }),
                JSON.stringify({ userId }),
                `receive-${grnLineId}`,
                userId
              ]
            );
          }
        }

        const [poLines] = await connection.execute(
          'SELECT status FROM purchase_order_lines WHERE po_id = ?',
          [poId]
        );

        let poStatus = 'sent';
        const allReceived = poLines.every(line => line.status === 'received');
        const anyReceived = poLines.some(line => line.status === 'partially_received' || line.status === 'received');

        if (allReceived) {
          poStatus = 'received';
        } else if (anyReceived) {
          poStatus = 'partially_received';
        } else {
          const [currentPO] = await connection.execute(
            'SELECT status FROM purchase_orders WHERE id = ?',
            [poId]
          );
          poStatus = currentPO[0]?.status || 'sent';
        }

        await connection.execute(
          'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          [poStatus, poId]
        );
      });

      logger.info('GRN created', { grnId, institutionId, grnNumber: resolvedGrnNumber, poId, userId });
      return grnId;
    } catch (error) {
      logger.error('Failed to create GRN', { institutionId, grnNumber, poId, error: error.message });
      throw error;
    }
  }

  async getPurchaseOrders(institutionId, filters = {}, limit = 100, offset = 0) {
    let query = `
      SELECT po.*, v.display_name as vendor_name,
             COUNT(pol.id) as line_count,
             SUM(pol.quantity_ordered) as total_quantity_ordered,
             SUM(pol.quantity_received) as total_quantity_received
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN purchase_order_lines pol ON po.id = pol.po_id
      WHERE po.institution_id = ?
    `;
    const params = [institutionId];

    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }

    if (filters.vendorId) {
      query += ' AND po.vendor_id = ?';
      params.push(filters.vendorId);
    }

    query += ' GROUP BY po.id ORDER BY po.created_at DESC';

    try {
      return await db.query(query, params);
    } catch (error) {
      console.error('Database query error:', error.message);
      throw error;
    }
  }

  async getPurchaseOrder(institutionId, poId) {
    const pos = await db.query(
      `SELECT po.*, COALESCE(v.display_name, po.vendor_name) as vendor_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.institution_id = ? AND po.id = ?`,
      [institutionId, poId]
    );

    if (pos.length === 0) return null;

    const po = pos[0];

    const lines = await db.query(
      `SELECT pol.*, i.hsn_code, i.name as item_name, i.unit, w.name as warehouse_name
       FROM purchase_order_lines pol
       JOIN items i ON pol.item_id = i.id
       LEFT JOIN warehouses w ON pol.warehouse_id = w.id
       WHERE pol.institution_id = ? AND pol.po_id = ?
       ORDER BY pol.line_number`,
      [institutionId, poId]
    );

    const grns = await db.query(
      `SELECT grn.*,
              COUNT(gl.id) as line_count,
              (SELECT pi.invoice_number FROM purchase_invoices pi WHERE pi.grn_id = grn.id LIMIT 1) as invoice_number
       FROM goods_receipt_notes grn
       LEFT JOIN grn_lines gl ON grn.id = gl.grn_id
       WHERE grn.institution_id = ? AND grn.po_id = ?
       GROUP BY grn.id
       ORDER BY grn.receipt_date DESC`,
      [institutionId, poId]
    );

    return { ...po, lines, grns };
  }

  async getGRN(institutionId, grnId) {
    const grns = await db.query(
      `SELECT grn.*, po.po_number
       FROM goods_receipt_notes grn
       JOIN purchase_orders po ON grn.po_id = po.id
       WHERE grn.institution_id = ? AND grn.id = ?`,
      [institutionId, grnId]
    );

    if (grns.length === 0) return null;

    const grn = grns[0];

    // Get GRN lines
    const lines = await db.query(
      `SELECT gl.*, i.sku, i.name as item_name, i.unit, pol.quantity_ordered, w.name as warehouse_name
       FROM grn_lines gl
       JOIN items i ON gl.item_id = i.id
       JOIN purchase_order_lines pol ON gl.po_line_id = pol.id
       LEFT JOIN warehouses w ON gl.warehouse_id = w.id
       WHERE gl.institution_id = ? AND gl.grn_id = ?`,
      [institutionId, grnId]
    );

    return { ...grn, lines };
  }

  async updatePOStatus(institutionId, poId, status, userId) {
    const result = await db.query(
      'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [status, institutionId, poId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Purchase order not found');
    }

    logger.info('PO status updated', { poId, institutionId, status, userId });
  }

  async updatePurchaseOrder(institutionId, poId, poData, userId) {
    const { vendorId, vendorName, currency, exchangeRate, orderDate, expectedDate, notes, lines } = poData;

    try {
      await db.transaction(async (connection) => {
        // Check if PO exists and is in draft status
        const [existingPO] = await connection.execute(
          'SELECT status FROM purchase_orders WHERE institution_id = ? AND id = ?',
          [institutionId, poId]
        );

        if (!existingPO || existingPO.length === 0) {
          throw new Error('Purchase order not found');
        }

        if (existingPO[0].status !== 'draft' && existingPO[0].status !== 'sent') {
          throw new Error('Only draft and sent purchase orders can be edited');
        }

        // FIX #3: Block edit if any GRN already exists — editing lines would break grn_lines.po_line_id references
        const [existingGRNs] = await connection.execute(
          'SELECT id FROM goods_receipt_notes WHERE po_id = ? LIMIT 1',
          [poId]
        );
        if (existingGRNs.length > 0) {
          throw new Error('Cannot edit purchase order lines after goods have been received. Cancel the GRN first.');
        }

        let subtotal = 0;

        // Update PO header
        await connection.execute(
          `UPDATE purchase_orders 
           SET vendor_id = ?, vendor_name = ?, currency = ?, exchange_rate = ?, 
               order_date = ?, expected_date = ?, notes = ?, updated_at = NOW()
           WHERE institution_id = ? AND id = ?`,
          [vendorId || null, vendorName, currency || 'USD', exchangeRate || 1.0, 
           orderDate, expectedDate || null, notes || null, institutionId, poId]
        );

        // Delete existing lines
        await connection.execute(
          'DELETE FROM purchase_order_lines WHERE institution_id = ? AND po_id = ?',
          [institutionId, poId]
        );

        // Insert new lines
        const updateExchangeRate = parseFloat(exchangeRate) || 1.0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineId = uuidv4();
          const lineTotalForeign = Math.round(line.quantity * line.unitCost * 100) / 100;
          const lineTotal = Math.round(lineTotalForeign * updateExchangeRate * 100) / 100;
          const discountRate = line.discountRate || 0;
          const taxRate = line.taxRate || 0;
          const discountAmount = Math.round((lineTotal * discountRate) / 100 * 100) / 100;
          const taxableAmount = lineTotal - discountAmount;
          const taxAmount = Math.round((taxableAmount * taxRate) / 100 * 100) / 100;
          subtotal += lineTotal;

          await connection.execute(
            `INSERT INTO purchase_order_lines 
             (id, institution_id, po_id, item_id, warehouse_id, line_number, quantity_ordered, unit_cost, line_total, tax_rate, tax_amount, discount_rate, discount_amount, expected_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, institutionId, poId, line.itemId, line.warehouseId, i + 1, line.quantity, line.unitCost, lineTotal, taxRate, taxAmount, discountRate, discountAmount, line.expectedDate || null]
          );
        }

        // Update totals
        await connection.execute(
          'UPDATE purchase_orders SET subtotal = ?, total_amount = ? WHERE id = ?',
          [subtotal, subtotal, poId]
        );
      });

      logger.info('Purchase order updated', { poId, institutionId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to update purchase order', { institutionId, poId, error: error.message });
      throw error;
    }
  }

  async getPendingReceipts(institutionId, warehouseId = null) {
    let query = `
      SELECT pol.*, po.po_number, po.vendor_name, i.sku, i.name as item_name,
             (pol.quantity_ordered - pol.quantity_received) as pending_quantity
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON pol.po_id = po.id
      JOIN items i ON pol.item_id = i.id
      WHERE pol.institution_id = ? 
        AND pol.status IN ('pending', 'partially_received')
        AND po.status IN ('sent', 'confirmed', 'partially_received')
    `;
    const params = [institutionId];

    // FIX #3: warehouse is on purchase_order_lines, not purchase_orders
    if (warehouseId) {
      query += ' AND pol.warehouse_id = ?';
      params.push(warehouseId);
    }

    query += ' ORDER BY pol.expected_date ASC, po.po_number';

    return await db.query(query, params);
  }

  async cancelPurchaseOrder(institutionId, poId, cancellationReason, userId) {
    if (!cancellationReason || !cancellationReason.trim()) {
      throw new Error('Cancellation reason is required');
    }

    // Fetch current PO to validate status and capture previous state for audit
    const [existing] = await db.query(
      'SELECT status, po_number FROM purchase_orders WHERE institution_id = ? AND id = ?',
      [institutionId, poId]
    );

    if (!existing) {
      throw new Error('Purchase order not found');
    }

    const allowedStatuses = ['draft', 'sent', 'confirmed'];
    if (!allowedStatuses.includes(existing.status)) {
      throw new Error(`Cannot cancel a purchase order with status '${existing.status}'. Only draft, sent, or confirmed orders can be cancelled.`);
    }

    await db.query(
      `UPDATE purchase_orders 
       SET status = 'cancelled', cancellation_reason = ?, updated_at = NOW() 
       WHERE institution_id = ? AND id = ?`,
      [cancellationReason.trim(), institutionId, poId]
    );

    // Record in audit log so history is preserved
    await auditLogService.log(
      institutionId,
      'purchase_order',
      poId,
      'purchase_order_cancelled',
      { previousStatus: existing.status, cancellationReason: cancellationReason.trim() },
      userId,
      null,
      `PO ${existing.po_number} cancelled from '${existing.status}' status. Reason: ${cancellationReason.trim()}`
    );

    logger.info('Purchase order cancelled', { poId, institutionId, previousStatus: existing.status, userId });
    return true;
  }
}

module.exports = new PurchaseOrderService();