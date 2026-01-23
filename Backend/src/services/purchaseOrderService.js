const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');
const inventoryService = require('./inventoryService');

class PurchaseOrderService {
  async createPurchaseOrder(tenantId, poData, userId) {
    const {
      poNumber,
      vendorId,
      vendorName,
      warehouseId,
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
        // Create PO header
        await connection.execute(
          `INSERT INTO purchase_orders 
           (id, tenant_id, po_number, vendor_id, vendor_name, warehouse_id, currency, exchange_rate, 
            order_date, expected_date, notes, created_by, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [poId, tenantId, poNumber, vendorId || null, vendorName, warehouseId, currency, exchangeRate, 
           orderDate || null, expectedDate || null, notes || null, userId]
        );

        // Create PO lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineId = uuidv4();
          const lineTotal = line.quantity * line.unitCost;
          subtotal += lineTotal;

          await connection.execute(
            `INSERT INTO purchase_order_lines 
             (id, tenant_id, po_id, item_id, line_number, quantity_ordered, unit_cost, line_total, expected_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, tenantId, poId, line.itemId, i + 1, line.quantity, line.unitCost, lineTotal, line.expectedDate || expectedDate || null]
          );
        }

        // Update PO totals
        await connection.execute(
          'UPDATE purchase_orders SET subtotal = ?, total_amount = ? WHERE id = ?',
          [subtotal, subtotal, poId]
        );
      });

      logger.info('Purchase order created', { poId, tenantId, poNumber, userId });
      return poId;
    } catch (error) {
      logger.error('Failed to create purchase order', { tenantId, poNumber, error: error.message });
      throw error;
    }
  }

  async createGRN(tenantId, grnData, userId) {
    console.log('=== GRN SERVICE DEBUG ===');
    console.log('tenantId:', tenantId);
    console.log('grnData:', JSON.stringify(grnData, null, 2));
    console.log('userId:', userId);
    console.log('grnData.poId:', grnData.poId);
    console.log('typeof grnData.poId:', typeof grnData.poId);
    console.log('=========================');

    const {
      grnNumber,
      poId,
      warehouseId,
      receiptDate,
      lines,
      notes
    } = grnData;

    // Validate required parameters
    if (!tenantId) throw new Error('tenantId is required');
    if (!poId) throw new Error(`poId is required. Received: ${poId}`);
    if (!warehouseId) throw new Error(`warehouseId is required. Received: ${warehouseId}`);
    if (!userId) throw new Error('userId is required');
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      throw new Error('lines array is required and must not be empty');
    }

    const grnId = uuidv4();

    try {
      await db.transaction(async (connection) => {
        // Create GRN header
        const grnParams = [
          grnId, 
          tenantId, 
          grnNumber || `GRN-${Date.now()}`, 
          poId, 
          warehouseId, 
          receiptDate || new Date().toISOString().split('T')[0], 
          userId, 
          notes || null
        ];
        
        console.log('GRN header params:', JSON.stringify(grnParams, null, 2));
        
        // Check for undefined values
        grnParams.forEach((param, index) => {
          if (param === undefined) {
            console.error(`Parameter at index ${index} is undefined`);
            throw new Error(`Parameter at index ${index} is undefined`);
          }
        });
        
        await connection.execute(
          `INSERT INTO goods_receipt_notes 
           (id, tenant_id, grn_number, po_id, warehouse_id, receipt_date, received_by, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          grnParams
        );

        // Process each GRN line
        for (const line of lines) {
          console.log('Processing line:', JSON.stringify(line, null, 2));
          
          // Validate line data
          if (!line.itemId) throw new Error('line.itemId is required');
          if (!line.poLineId) throw new Error('line.poLineId is required');
          if (line.quantityReceived === undefined || line.quantityReceived === null) {
            throw new Error('line.quantityReceived is required');
          }
          if (line.unitCost === undefined || line.unitCost === null) {
            throw new Error('line.unitCost is required');
          }
          
          const grnLineId = uuidv4();
          const lineTotal = line.quantityReceived * line.unitCost;

          const lineParams = [
            grnLineId, 
            tenantId, 
            grnId, 
            line.poLineId, 
            line.itemId, 
            line.quantityReceived, 
            line.unitCost, 
            lineTotal, 
            line.qualityStatus || 'accepted'
          ];
          
          console.log('GRN line params:', JSON.stringify(lineParams, null, 2));
          
          // Check for undefined values
          lineParams.forEach((param, index) => {
            if (param === undefined) {
              console.error(`Line parameter at index ${index} is undefined`);
              throw new Error(`Line parameter at index ${index} is undefined`);
            }
          });

          // Create GRN line
          await connection.execute(
            `INSERT INTO grn_lines 
             (id, tenant_id, grn_id, po_line_id, item_id, quantity_received, unit_cost, line_total, quality_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            lineParams
          );

          // Update PO line received quantity
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

          // Create inventory event for accepted items
          if (line.qualityStatus === 'accepted' || !line.qualityStatus) {
            await inventoryService.receiveStock(tenantId, {
              itemId: line.itemId,
              warehouseId,
              quantity: line.quantityReceived,
              unitCost: line.unitCost,
              poId,
              poLineId: line.poLineId,
              grnNumber: grnNumber || `GRN-${Date.now()}`
            }, userId);
          }
        }

        // Update PO status based on line statuses
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
        }

        await connection.execute(
          'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          [poStatus, poId]
        );
      });

      logger.info('GRN created', { grnId, tenantId, grnNumber, poId, userId });
      return grnId;
    } catch (error) {
      logger.error('Failed to create GRN', { tenantId, grnNumber, poId, error: error.message });
      throw error;
    }
  }

  async getPurchaseOrders(tenantId, filters = {}, limit = 100, offset = 0) {
    let query = `
      SELECT po.*, v.name as vendor_name, w.name as warehouse_name,
             COUNT(pol.id) as line_count,
             SUM(pol.quantity_ordered) as total_quantity_ordered,
             SUM(pol.quantity_received) as total_quantity_received
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      LEFT JOIN purchase_order_lines pol ON po.id = pol.po_id
      WHERE po.tenant_id = ?
    `;
    const params = [tenantId];

    if (filters.status) {
      query += ' AND po.status = ?';
      params.push(filters.status);
    }

    if (filters.vendorId) {
      query += ' AND po.vendor_id = ?';
      params.push(filters.vendorId);
    }

    query += ' GROUP BY po.id ORDER BY po.created_at DESC';

    return await db.query(query, params);
  }

  async getPurchaseOrder(tenantId, poId) {
    const [pos] = await db.query(
      `SELECT po.*, v.name as vendor_name, w.name as warehouse_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN warehouses w ON po.warehouse_id = w.id
       WHERE po.tenant_id = ? AND po.id = ?`,
      [tenantId, poId]
    );

    if (pos.length === 0) return null;

    const po = pos[0];

    // Get PO lines
    const lines = await db.query(
      `SELECT pol.*, i.sku, i.name as item_name, i.unit
       FROM purchase_order_lines pol
       JOIN items i ON pol.item_id = i.id
       WHERE pol.tenant_id = ? AND pol.po_id = ?
       ORDER BY pol.line_number`,
      [tenantId, poId]
    );

    // Get GRNs
    const grns = await db.query(
      `SELECT grn.*, COUNT(gl.id) as line_count
       FROM goods_receipt_notes grn
       LEFT JOIN grn_lines gl ON grn.id = gl.grn_id
       WHERE grn.tenant_id = ? AND grn.po_id = ?
       GROUP BY grn.id
       ORDER BY grn.receipt_date DESC`,
      [tenantId, poId]
    );

    return { ...po, lines, grns };
  }

  async getGRN(tenantId, grnId) {
    const [grns] = await db.query(
      `SELECT grn.*, po.po_number, w.name as warehouse_name
       FROM goods_receipt_notes grn
       JOIN purchase_orders po ON grn.po_id = po.id
       LEFT JOIN warehouses w ON grn.warehouse_id = w.id
       WHERE grn.tenant_id = ? AND grn.id = ?`,
      [tenantId, grnId]
    );

    if (grns.length === 0) return null;

    const grn = grns[0];

    // Get GRN lines
    const lines = await db.query(
      `SELECT gl.*, i.sku, i.name as item_name, i.unit, pol.quantity_ordered
       FROM grn_lines gl
       JOIN items i ON gl.item_id = i.id
       JOIN purchase_order_lines pol ON gl.po_line_id = pol.id
       WHERE gl.tenant_id = ? AND gl.grn_id = ?`,
      [tenantId, grnId]
    );

    return { ...grn, lines };
  }

  async updatePOStatus(tenantId, poId, status, userId) {
    const result = await db.query(
      'UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?',
      [status, tenantId, poId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Purchase order not found');
    }

    logger.info('PO status updated', { poId, tenantId, status, userId });
  }

  async getPendingReceipts(tenantId, warehouseId = null) {
    let query = `
      SELECT pol.*, po.po_number, po.vendor_name, i.sku, i.name as item_name,
             (pol.quantity_ordered - pol.quantity_received) as pending_quantity
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON pol.po_id = po.id
      JOIN items i ON pol.item_id = i.id
      WHERE pol.tenant_id = ? 
        AND pol.status IN ('pending', 'partially_received')
        AND po.status IN ('sent', 'confirmed', 'partially_received')
    `;
    const params = [tenantId];

    if (warehouseId) {
      query += ' AND po.warehouse_id = ?';
      params.push(warehouseId);
    }

    query += ' ORDER BY pol.expected_date ASC, po.po_number';

    return await db.query(query, params);
  }
}

module.exports = new PurchaseOrderService();