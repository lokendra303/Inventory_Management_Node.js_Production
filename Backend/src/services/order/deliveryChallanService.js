const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class DeliveryChallanService {
  async createChallan(institutionId, data, userId) {
    const { soId, customerId, customerName, warehouseId, challanDate, vehicleNumber, driverName, notes, lines } = data;
    if (!lines || !lines.length) throw new Error('Challan lines are required');

    // Validate warehouse is active if provided
    if (warehouseId) {
      const [wh] = await db.query('SELECT id FROM warehouses WHERE id=? AND institution_id=? AND status=\'active\'', [warehouseId, institutionId]);
      if (!wh) throw new Error('Warehouse not found or inactive');
    }

    const id = uuidv4();
    const challanNumber = `DC-${Date.now()}`;

    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO delivery_challans
         (id, institution_id, challan_number, so_id, customer_id, customer_name, warehouse_id,
          challan_date, vehicle_number, driver_name, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, institutionId, challanNumber, soId || null, customerId || null, customerName,
         warehouseId || null, challanDate, vehicleNumber || null, driverName || null, notes || null, userId]
      );

      for (const line of lines) {
        const lineTotal = parseFloat(line.quantity) * parseFloat(line.unitPrice || 0);
        await conn.execute(
          `INSERT INTO delivery_challan_lines
           (id, institution_id, challan_id, item_id, so_line_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), institutionId, id, line.itemId, line.soLineId || null,
           line.quantity, line.unitPrice || 0, lineTotal]
        );
      }
    });

    logger.info('Delivery challan created', { id, institutionId, challanNumber, userId });
    return { id, challanNumber };
  }

  async getChallans(institutionId, filters = {}) {
    let query = `
      SELECT dc.*, c.display_name as customer_display_name, w.name as warehouse_name,
             COUNT(dcl.id) as line_count
      FROM delivery_challans dc
      LEFT JOIN customers c ON dc.customer_id = c.id
      LEFT JOIN warehouses w ON dc.warehouse_id = w.id
      LEFT JOIN delivery_challan_lines dcl ON dc.id = dcl.challan_id
      WHERE dc.institution_id = ? AND (c.status = 'active' OR c.id IS NULL) AND (w.status = 'active' OR w.id IS NULL)`;
    const params = [institutionId];

    if (filters.status)     { query += ' AND dc.status = ?';      params.push(filters.status); }
    if (filters.customerId) { query += ' AND dc.customer_id = ?'; params.push(filters.customerId); }
    if (filters.soId)       { query += ' AND dc.so_id = ?';       params.push(filters.soId); }

    query += ' GROUP BY dc.id ORDER BY dc.created_at DESC';
    return db.query(query, params);
  }

  async getChallan(institutionId, challanId) {
    const challans = await db.query(
      `SELECT dc.*, c.display_name as customer_display_name, w.name as warehouse_name
       FROM delivery_challans dc
       LEFT JOIN customers c ON dc.customer_id = c.id
       LEFT JOIN warehouses w ON dc.warehouse_id = w.id
       WHERE dc.institution_id = ? AND dc.id = ?`,
      [institutionId, challanId]
    );
    if (!challans.length) return null;

    const lines = await db.query(
      `SELECT dcl.*, i.name as item_name, i.sku
       FROM delivery_challan_lines dcl
       JOIN items i ON dcl.item_id = i.id
       WHERE dcl.institution_id = ? AND dcl.challan_id = ?`,
      [institutionId, challanId]
    );

    return { ...challans[0], lines };
  }

  async updateStatus(institutionId, challanId, status, userId) {
    const result = await db.query(
      'UPDATE delivery_challans SET status=?, updated_at=NOW() WHERE institution_id=? AND id=?',
      [status, institutionId, challanId]
    );
    if (result.affectedRows === 0) throw new Error('Challan not found');
    logger.info('Challan status updated', { challanId, status, institutionId, userId });
    return true;
  }

  /** Convert challan to sales invoice */
  async convertToInvoice(institutionId, challanId, userId) {
    const challan = await this.getChallan(institutionId, challanId);
    if (!challan) throw new Error('Challan not found');
    if (challan.status === 'invoiced') throw new Error('Challan already invoiced');
    if (challan.status === 'cancelled') throw new Error('Cannot invoice a cancelled challan');

    const invoiceService = require('../invoice/invoiceService');
    const invoiceId = await invoiceService.createSalesInvoice(institutionId, {
      customerId: challan.customer_id,
      customerName: challan.customer_display_name || challan.customer_name,
      soId: challan.so_id,
      challanId,
      invoiceDate: new Date().toISOString().split('T')[0],
      lines: challan.lines.map(l => ({
        itemId: l.item_id,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        lineTotal: l.line_total
      }))
    }, userId);

    await db.query(
      'UPDATE delivery_challans SET status=\'invoiced\', invoice_id=?, updated_at=NOW() WHERE id=?',
      [invoiceId, challanId]
    );

    logger.info('Challan converted to invoice', { challanId, invoiceId, institutionId, userId });
    return invoiceId;
  }
}

module.exports = new DeliveryChallanService();
