const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

class PutawayService {
  async getPendingPutaways(institutionId, filters = {}) {
    const clauses = [
      'gl.institution_id = ?',
      "gl.quality_status = 'accepted'",
      '(gl.quantity_received - COALESCE(gl.quantity_putaway, 0)) > 0',
    ];
    const params = [institutionId];

    if (filters.warehouseId) {
      clauses.push('gl.warehouse_id = ?');
      params.push(filters.warehouseId);
    }

    const rows = await db.query(
      `SELECT gl.id AS grn_line_id, gl.grn_id, gl.po_line_id, gl.item_id, gl.warehouse_id,
              gl.quantity_received, COALESCE(gl.quantity_putaway, 0) AS quantity_putaway,
              (gl.quantity_received - COALESCE(gl.quantity_putaway, 0)) AS pending_quantity,
              gl.unit_cost,
              grn.grn_number, grn.receipt_date, grn.po_id,
              po.po_number, po.vendor_name,
              i.sku, i.name AS item_name, i.default_bin_id,
              w.name AS warehouse_name
         FROM grn_lines gl
         JOIN goods_receipt_notes grn ON gl.grn_id = grn.id
         JOIN purchase_orders po ON grn.po_id = po.id
         JOIN items i ON gl.item_id = i.id
         LEFT JOIN warehouses w ON gl.warehouse_id = w.id
        WHERE ${clauses.join(' AND ')}
        ORDER BY grn.receipt_date ASC, grn.grn_number, i.name`,
      params
    );

    return rows.map((row) => ({
      grnLineId: row.grn_line_id,
      grnId: row.grn_id,
      poLineId: row.po_line_id,
      itemId: row.item_id,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      quantityReceived: Number(row.quantity_received),
      quantityPutaway: Number(row.quantity_putaway),
      pendingQuantity: Number(row.pending_quantity),
      unitCost: Number(row.unit_cost),
      grnNumber: row.grn_number,
      receiptDate: row.receipt_date,
      poId: row.po_id,
      poNumber: row.po_number,
      vendorName: row.vendor_name,
      sku: row.sku,
      itemName: row.item_name,
      defaultBinId: row.default_bin_id || null,
    }));
  }

  async getPutawayHistory(institutionId, filters = {}) {
    const clauses = ['pr.institution_id = ?'];
    const params = [institutionId];

    if (filters.warehouseId) {
      clauses.push('pr.warehouse_id = ?');
      params.push(filters.warehouseId);
    }

    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);

    const rows = await db.query(
      `SELECT pr.*, grn.grn_number, po.po_number,
              i.sku, i.name AS item_name,
              b.code AS bin_code, b.name AS bin_name,
              z.name AS zone_name, r.name AS rack_name,
              w.name AS warehouse_name
         FROM putaway_records pr
         JOIN grn_lines gl ON pr.grn_line_id = gl.id
         JOIN goods_receipt_notes grn ON pr.grn_id = grn.id
         JOIN purchase_orders po ON grn.po_id = po.id
         JOIN items i ON pr.item_id = i.id
         JOIN warehouse_bins b ON pr.bin_id = b.id
         JOIN warehouse_zones z ON b.zone_id = z.id
         JOIN warehouse_racks r ON b.rack_id = r.id
         JOIN warehouses w ON pr.warehouse_id = w.id
        WHERE ${clauses.join(' AND ')}
        ORDER BY pr.putaway_date DESC, pr.created_at DESC
        LIMIT ${limit}`,
      params
    );

    return rows;
  }

  async completePutaway(institutionId, data, userId) {
    const { grnLineId, binId, quantity, notes } = data;

    if (!grnLineId) throw new Error('grnLineId is required');
    if (!binId) throw new Error('binId is required');

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('quantity must be a positive number');
    }

    return db.transaction(async (connection) => {
      const [lineRows] = await connection.execute(
        `SELECT gl.*, i.default_bin_id
           FROM grn_lines gl
           JOIN items i ON gl.item_id = i.id
          WHERE gl.institution_id = ? AND gl.id = ?
          FOR UPDATE`,
        [institutionId, grnLineId]
      );

      if (!lineRows.length) throw new Error('GRN line not found');
      const line = lineRows[0];

      if (line.quality_status !== 'accepted') {
        throw new Error('Only accepted GRN lines can be put away');
      }

      const pending = Number(line.quantity_received) - Number(line.quantity_putaway || 0);
      if (qty > pending) {
        throw new Error(`Cannot put away ${qty} units — only ${pending} pending`);
      }

      const [binRows] = await connection.execute(
        `SELECT b.id, b.warehouse_id, b.status, b.code, b.name
           FROM warehouse_bins b
          WHERE b.institution_id = ? AND b.id = ?`,
        [institutionId, binId]
      );

      if (!binRows.length) throw new Error('Bin not found');
      const bin = binRows[0];

      if (line.warehouse_id && bin.warehouse_id !== line.warehouse_id) {
        throw new Error('Bin must belong to the same warehouse as the GRN line');
      }

      if (!['active'].includes(bin.status)) {
        throw new Error(`Bin "${bin.code}" is not available for putaway (status: ${bin.status})`);
      }

      const putawayId = uuidv4();
      await connection.execute(
        `INSERT INTO putaway_records
           (id, institution_id, grn_line_id, grn_id, item_id, warehouse_id, bin_id, quantity, notes, putaway_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          putawayId,
          institutionId,
          grnLineId,
          line.grn_id,
          line.item_id,
          bin.warehouse_id,
          binId,
          qty,
          notes || null,
          userId || null,
        ]
      );

      await connection.execute(
        `UPDATE grn_lines
            SET quantity_putaway = COALESCE(quantity_putaway, 0) + ?
          WHERE institution_id = ? AND id = ?`,
        [qty, institutionId, grnLineId]
      );

      const [stockRows] = await connection.execute(
        `SELECT id, quantity FROM warehouse_bin_stock
          WHERE institution_id = ? AND bin_id = ? AND item_id = ?
          FOR UPDATE`,
        [institutionId, binId, line.item_id]
      );

      if (stockRows.length) {
        await connection.execute(
          `UPDATE warehouse_bin_stock
              SET quantity = quantity + ?, updated_at = NOW()
            WHERE id = ?`,
          [qty, stockRows[0].id]
        );
      } else {
        await connection.execute(
          `INSERT INTO warehouse_bin_stock
             (id, institution_id, warehouse_id, bin_id, item_id, quantity)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), institutionId, bin.warehouse_id, binId, line.item_id, qty]
        );
      }

      logger.info('Putaway completed', {
        putawayId,
        institutionId,
        grnLineId,
        binId,
        quantity: qty,
        userId,
      });

      return {
        putawayId,
        grnLineId,
        binId,
        quantity: qty,
        remainingPending: pending - qty,
      };
    });
  }
}

module.exports = new PutawayService();
