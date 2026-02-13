const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');
const inventoryService = require('./inventoryService');

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

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.warehouseId) {
            throw new Error('Warehouse is required for each line item');
          }
          
          const lineId = uuidv4();
          const lineTotal = line.quantity * line.unitCost;
          subtotal += lineTotal;

          let lineExpectedDate = line.expectedDate || formattedExpectedDate || null;
          if (lineExpectedDate && typeof lineExpectedDate === 'object') {
            lineExpectedDate = null;
          }
          
          await connection.execute(
            `INSERT INTO purchase_order_lines 
             (id, institution_id, po_id, item_id, warehouse_id, line_number, quantity_ordered, unit_cost, line_total, expected_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [lineId, institutionId, poId, line.itemId, line.warehouseId, i + 1, line.quantity, line.unitCost, lineTotal, lineExpectedDate]
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

    try {
      await db.transaction(async (connection) => {
        await connection.execute(
          `INSERT INTO goods_receipt_notes 
           (id, institution_id, grn_number, po_id, receipt_date, received_by, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [grnId, institutionId, grnNumber || `GRN-${Date.now()}`, poId, formattedReceiptDate, receivedBy, notes || null]
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
          
          const grnLineId = uuidv4();
          const lineTotal = line.quantityReceived * line.unitCost;

          await connection.execute(
            `INSERT INTO grn_lines 
             (id, institution_id, grn_id, po_line_id, item_id, quantity_received, unit_cost, line_total, quality_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [grnLineId, institutionId, grnId, line.poLineId, line.itemId, line.quantityReceived, line.unitCost, lineTotal, line.qualityStatus || 'accepted']
          );

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

          if (line.qualityStatus === 'accepted' || !line.qualityStatus) {
            await inventoryService.receiveStock(institutionId, {
              itemId: line.itemId,
              warehouseId: line.warehouseId,
              quantity: Number(line.quantityReceived),
              unitCost: Number(line.unitCost),
              poId,
              poLineId: line.poLineId,
              grnNumber: grnNumber || `GRN-${Date.now()}`
            }, userId);
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

      logger.info('GRN created', { grnId, institutionId, grnNumber, poId, userId });
      return grnId;
    } catch (error) {
      logger.error('Failed to create GRN', { institutionId, grnNumber, poId, error: error.message });
      throw error;
    }
  }

  async getPurchaseOrders(institutionId, filters = {}, limit = 100, offset = 0) {
    console.log('=== DEBUG getPurchaseOrders ===');
    console.log('institutionId:', institutionId);
    console.log('filters:', filters);
    
    let query = `
      SELECT po.*, v.display_name as vendor_name, w.name as warehouse_name,
             COUNT(pol.id) as line_count,
             SUM(pol.quantity_ordered) as total_quantity_ordered,
             SUM(pol.quantity_received) as total_quantity_received
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
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
    
    console.log('Final query:', query);
    console.log('Params:', params);

    try {
      const result = await db.query(query, params);
      console.log('Query result count:', result.length);
      return result;
    } catch (error) {
      console.error('Database query error:', error.message);
      throw error;
    }
  }

  async getPurchaseOrder(institutionId, poId) {
    const pos = await db.query(
      `SELECT po.*, COALESCE(v.display_name, po.vendor_name) as vendor_name, w.name as warehouse_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       LEFT JOIN warehouses w ON po.warehouse_id = w.id
       WHERE po.institution_id = ? AND po.id = ?`,
      [institutionId, poId]
    );

    if (pos.length === 0) return null;

    const po = pos[0];

    const lines = await db.query(
      `SELECT pol.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name
       FROM purchase_order_lines pol
       JOIN items i ON pol.item_id = i.id
       LEFT JOIN warehouses w ON pol.warehouse_id = w.id
       WHERE pol.institution_id = ? AND pol.po_id = ?
       ORDER BY pol.line_number`,
      [institutionId, poId]
    );

    const grns = await db.query(
      `SELECT grn.*, COUNT(gl.id) as line_count
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
    const [grns] = await db.query(
      `SELECT grn.*, po.po_number, w.name as warehouse_name
       FROM goods_receipt_notes grn
       JOIN purchase_orders po ON grn.po_id = po.id
       LEFT JOIN warehouses w ON grn.warehouse_id = w.id
       WHERE grn.institution_id = ? AND grn.id = ?`,
      [institutionId, grnId]
    );

    if (grns.length === 0) return null;

    const grn = grns[0];

    // Get GRN lines
    const lines = await db.query(
      `SELECT gl.*, i.sku, i.name as item_name, i.unit, pol.quantity_ordered
       FROM grn_lines gl
       JOIN items i ON gl.item_id = i.id
       JOIN purchase_order_lines pol ON gl.po_line_id = pol.id
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

    if (warehouseId) {
      query += ' AND po.warehouse_id = ?';
      params.push(warehouseId);
    }

    query += ' ORDER BY pol.expected_date ASC, po.po_number';

    return await db.query(query, params);
  }
}

module.exports = new PurchaseOrderService();