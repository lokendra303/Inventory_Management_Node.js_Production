const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class PurchaseReturnService {
  async createPurchaseReturn(institutionId, data, userId) {
    const {
      poId, grnId, vendorId, vendorName,
      returnDate, reason, lines
    } = data;

    if (!lines || lines.length === 0) throw new Error('Return lines are required');

    const id = uuidv4();
    const returnNumber = `PR-${Date.now()}`;
    let subtotal = 0;

    await db.transaction(async (conn) => {
      for (const line of lines) {
        const lineTotal = parseFloat(line.quantity) * parseFloat(line.unitCost);
        subtotal += lineTotal;
      }

      await conn.execute(
        `INSERT INTO purchase_returns
         (id, institution_id, return_number, po_id, grn_id, vendor_id, vendor_name,
          return_date, reason, subtotal, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, institutionId, returnNumber, poId || null, grnId || null,
         vendorId || null, vendorName, returnDate, reason || null,
         subtotal, subtotal, userId]
      );

      for (const line of lines) {
        const lineTotal = parseFloat(line.quantity) * parseFloat(line.unitCost);
        await conn.execute(
          `INSERT INTO purchase_return_lines
           (id, institution_id, return_id, item_id, warehouse_id, quantity, unit_cost, line_total, return_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), institutionId, id, line.itemId, line.warehouseId,
           line.quantity, line.unitCost, lineTotal, line.returnReason || null]
        );
      }
    });

    logger.info('Purchase return created (draft)', { id, institutionId, returnNumber, userId });
    return { id, returnNumber };
  }

  async confirmPurchaseReturn(institutionId, returnId, userId) {
    const returns = await db.query(
      'SELECT * FROM purchase_returns WHERE institution_id = ? AND id = ?',
      [institutionId, returnId]
    );
    if (!returns.length) throw new Error('Purchase return not found');
    if (returns[0].status !== 'draft') throw new Error('Only draft returns can be confirmed');

    const lines = await db.query(
      'SELECT * FROM purchase_return_lines WHERE institution_id = ? AND return_id = ?',
      [institutionId, returnId]
    );

    // Deduct stock for each line
    for (const line of lines) {
      // FIX #5: Validate return qty does not exceed total received qty minus already returned qty
      const [receivedResult] = await db.query(
        `SELECT COALESCE(SUM(gl.quantity_received), 0) as total_received
         FROM grn_lines gl
         JOIN goods_receipt_notes grn ON gl.grn_id = grn.id
         WHERE gl.institution_id = ? AND gl.item_id = ? AND gl.warehouse_id = ?
           AND gl.quality_status != 'rejected'
           AND grn.po_id = ?`,
        [institutionId, line.item_id, line.warehouse_id, returns[0].po_id]
      );
      const [alreadyReturnedResult] = await db.query(
        `SELECT COALESCE(SUM(prl.quantity), 0) as total_returned
         FROM purchase_return_lines prl
         JOIN purchase_returns pr ON prl.return_id = pr.id
         WHERE prl.institution_id = ? AND prl.item_id = ? AND prl.warehouse_id = ?
           AND pr.po_id = ? AND pr.status = 'confirmed' AND pr.id != ?`,
        [institutionId, line.item_id, line.warehouse_id, returns[0].po_id, returnId]
      );
      const maxReturnable = parseFloat(receivedResult.total_received) - parseFloat(alreadyReturnedResult.total_returned);
      if (parseFloat(line.quantity) > maxReturnable) {
        throw new Error(`Cannot return ${line.quantity} units for item ${line.item_id} — only ${maxReturnable} units eligible for return`);
      }

      const [proj] = await db.query(
        'SELECT * FROM inventory_projections WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?',
        [institutionId, line.item_id, line.warehouse_id]
      );

      if (!proj.length) throw new Error(`No inventory found for item ${line.item_id}`);

      const current = proj[0];
      const qty = parseFloat(line.quantity);
      const available = parseFloat(current.quantity_available);

      if (available < qty) {
        throw new Error(`Insufficient stock to return: available ${available}, requested ${qty}`);
      }

      const newOnHand = parseFloat(current.quantity_on_hand) - qty;
      const newAvailable = parseFloat(current.quantity_available) - qty;
      const newValue = newOnHand * parseFloat(current.average_cost);

      await db.query(
        `UPDATE inventory_projections
         SET quantity_on_hand = ?, quantity_available = ?, total_value = ?, last_movement_date = NOW()
         WHERE institution_id = ? AND item_id = ? AND warehouse_id = ?`,
        [newOnHand, newAvailable, newValue, institutionId, line.item_id, line.warehouse_id]
      );

      // Audit trail
      await db.query(
        `INSERT INTO inventory_adjustments
         (id, institution_id, item_id, warehouse_id, adjustment_type, quantity_change,
          reason, loss_type, adjusted_by, reference_number)
         VALUES (?, ?, ?, ?, 'decrease', ?, ?, 'OTHER', ?, ?)`,
        [uuidv4(), institutionId, line.item_id, line.warehouse_id,
         qty, `Purchase Return: ${returns[0].return_number}`,
         userId, returns[0].return_number]
      );
    }

    const debitNoteNumber = `DN-${Date.now()}`;
    await db.query(
      `UPDATE purchase_returns
       SET status = 'confirmed', debit_note_number = ?, updated_at = NOW()
       WHERE id = ?`,
      [debitNoteNumber, returnId]
    );

    logger.info('Purchase return confirmed', { returnId, institutionId, debitNoteNumber, userId });
    return { debitNoteNumber };
  }

  async getPurchaseReturns(institutionId, filters = {}) {
    let query = `
      SELECT pr.*, v.display_name as vendor_display_name,
             COUNT(prl.id) as line_count
      FROM purchase_returns pr
      LEFT JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN purchase_return_lines prl ON pr.id = prl.return_id
      WHERE pr.institution_id = ?`;
    const params = [institutionId];

    if (filters.status)   { query += ' AND pr.status = ?';    params.push(filters.status); }
    if (filters.vendorId) { query += ' AND pr.vendor_id = ?'; params.push(filters.vendorId); }

    query += ' GROUP BY pr.id ORDER BY pr.created_at DESC';
    return db.query(query, params);
  }

  async getPurchaseReturn(institutionId, returnId) {
    const returns = await db.query(
      `SELECT pr.*, v.display_name as vendor_display_name
       FROM purchase_returns pr
       LEFT JOIN vendors v ON pr.vendor_id = v.id
       WHERE pr.institution_id = ? AND pr.id = ?`,
      [institutionId, returnId]
    );
    if (!returns.length) return null;

    const lines = await db.query(
      `SELECT prl.*, i.name as item_name, i.sku, w.name as warehouse_name
       FROM purchase_return_lines prl
       JOIN items i ON prl.item_id = i.id
       JOIN warehouses w ON prl.warehouse_id = w.id
       WHERE prl.institution_id = ? AND prl.return_id = ?`,
      [institutionId, returnId]
    );

    return { ...returns[0], lines };
  }

  async cancelPurchaseReturn(institutionId, returnId, userId) {
    const result = await db.query(
      `UPDATE purchase_returns SET status = 'cancelled', updated_at = NOW()
       WHERE institution_id = ? AND id = ? AND status = 'draft'`,
      [institutionId, returnId]
    );
    if (result.affectedRows === 0) throw new Error('Return not found or cannot be cancelled');
    logger.info('Purchase return cancelled', { returnId, institutionId, userId });
    return true;
  }
}

module.exports = new PurchaseReturnService();
