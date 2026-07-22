const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const inventoryService = require('../inventory/inventory.service');
const compositeInventoryService = require('../inventory/compositeInventory.service');
const itemService = require('../entity/item.service');
const { serializeDocumentMeta } = require('../../utils/documentMeta');

class SOConfirmationService {
  /**
   * Confirm a sales order — validates stock and marks as confirmed.
   * Inventory is reduced on ship (POST /sales-orders/:id/ship), mirroring PO confirm → receive.
   */
  async processSOConfirmation(institutionId, soId, userId, options = {}) {
    void options;

    try {
      const result = await db.transaction(async (connection) => {
        const [soResult] = await connection.execute(
          `SELECT so.*, w.name as warehouse_name 
           FROM sales_orders so 
           LEFT JOIN warehouses w ON so.warehouse_id = w.id 
           WHERE so.institution_id = ? AND so.id = ?`,
          [institutionId, soId]
        );

        if (soResult.length === 0) {
          throw new Error('Sales order not found');
        }

        const so = soResult[0];
        if (so.status !== 'draft') {
          throw new Error(`Cannot confirm sales order in status "${so.status}"`);
        }

        const [lines] = await connection.execute(
          `SELECT sol.*, i.sku, i.name as item_name, i.unit,
                  i.is_batch_tracked, i.is_serialized, i.has_expiry
           FROM sales_order_lines sol
           JOIN items i ON sol.item_id = i.id
           WHERE sol.institution_id = ? AND sol.so_id = ?
           ORDER BY sol.line_number`,
          [institutionId, soId]
        );

        if (lines.length === 0) {
          throw new Error('No sales order lines found');
        }

        for (const line of lines) {
          const requiredQty = Number(line.quantity_ordered);
          const fulfillmentMode = await compositeInventoryService.getFulfillmentMode(
            institutionId,
            line.item_id
          );

          if (fulfillmentMode === 'explode_on_ship') {
            const components = await itemService.getCompositeComponents(
              institutionId,
              line.item_id
            );
            const {
              convertBomLineToStockQty,
              loadInstitutionUnits,
            } = require('../../utils/bomUnitConversion');
            const units = await loadInstitutionUnits(institutionId);
            for (const c of components) {
              const { quantityInStockUnit } = await convertBomLineToStockQty(institutionId, {
                quantityRequired: c.quantity_required,
                consumptionUnitId: c.consumption_unit_id,
                consumeFullPack: c.consume_full_pack,
                componentItemId: c.component_item_id,
                units,
              });
              const compQty = requiredQty * quantityInStockUnit;
              const stock = await inventoryService.getCurrentStock(
                institutionId,
                c.component_item_id,
                line.warehouse_id,
                null
              );
              const availableQty = stock ? Number(stock.quantity_available) : 0;
              if (availableQty < compQty) {
                throw new Error(
                  `Insufficient component stock for finished product ${line.item_name} (${c.component_name || c.sku}): ` +
                    `available ${availableQty}, required ${compQty}`
                );
              }
            }
            continue;
          }

          const stock = await inventoryService.getCurrentStock(
            institutionId,
            line.item_id,
            line.warehouse_id,
            line.item_variant_id || null
          );
          const reservedQty = stock ? Number(stock.quantity_reserved) : 0;
          const onHandQty = stock ? Number(stock.quantity_on_hand) : 0;

          if (reservedQty < requiredQty && onHandQty < requiredQty) {
            throw new Error(
              `Insufficient stock for ${line.item_name}. Available: ${onHandQty}, Required: ${requiredQty}`
            );
          }
        }

        await connection.execute(
          `UPDATE sales_order_lines
           SET status = 'reserved', updated_at = NOW()
           WHERE institution_id = ? AND so_id = ?`,
          [institutionId, soId]
        );

        await connection.execute(
          'UPDATE sales_orders SET status = ?, updated_at = NOW() WHERE id = ?',
          ['confirmed', soId]
        );

        logger.info('SO confirmed — awaiting shipment', {
          soId,
          soNumber: so.so_number,
          totalLines: lines.length,
          institutionId,
          userId,
        });

        return {
          success: true,
          message: 'Sales order confirmed. Ship stock to deduct inventory and generate invoice.',
          itemsProcessed: lines.length,
          warehouseUpdated: so.warehouse_name || so.warehouse_id,
        };
      });

      return result;
    } catch (error) {
      logger.error('Failed to process SO confirmation', {
        soId,
        institutionId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async createInvoiceForShippedSO(institutionId, soId, userId, connection) {
    const [existing] = await connection.execute(
      'SELECT id FROM sales_invoices WHERE institution_id = ? AND so_id = ? LIMIT 1',
      [institutionId, soId]
    );
    if (existing.length > 0) {
      return { invoiceId: existing[0].id, created: false };
    }

    const [soResult] = await connection.execute(
      'SELECT * FROM sales_orders WHERE institution_id = ? AND id = ?',
      [institutionId, soId]
    );
    if (soResult.length === 0) {
      throw new Error('Sales order not found');
    }
    const so = soResult[0];

    const [lines] = await connection.execute(
      `SELECT sol.*, i.name as item_name
       FROM sales_order_lines sol
       JOIN items i ON sol.item_id = i.id
       WHERE sol.institution_id = ? AND sol.so_id = ?
       ORDER BY sol.line_number`,
      [institutionId, soId]
    );

    const invoiceId = uuidv4();
    const invoiceNumber = `SI-${so.so_number}-${Date.now()}`;

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const line of lines) {
      const lineBase = parseFloat(line.quantity_ordered) * parseFloat(line.unit_price);
      const taxRate = parseFloat(line.tax_rate || 0);
      const discountRate = parseFloat(line.discount_rate || 0);
      const discAmt = lineBase * discountRate / 100;
      const taxAmt = (lineBase - discAmt) * taxRate / 100;
      subtotal += lineBase;
      totalTax += taxAmt;
      totalDiscount += discAmt;
    }

    const grandTotal = subtotal + totalTax - totalDiscount;
    const documentMetaJson = serializeDocumentMeta(so.document_meta);

    await connection.execute(`
      INSERT INTO sales_invoices (
        id, institution_id, invoice_number, customer_id, customer_name, so_id,
        invoice_date, due_date, currency, exchange_rate, subtotal, tax_amount,
        discount_amount, total_amount, paid_amount, balance_amount, document_meta, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?)
    `, [
      invoiceId, institutionId, invoiceNumber, so.customer_id, so.customer_name, soId,
      new Date().toISOString().split('T')[0], null, so.currency || 'INR', 1,
      subtotal, totalTax, totalDiscount, grandTotal, 0, grandTotal, documentMetaJson, userId,
    ]);

    for (const line of lines) {
      const lineBase = parseFloat(line.quantity_ordered) * parseFloat(line.unit_price);
      const taxRate = parseFloat(line.tax_rate || 0);
      const discountRate = parseFloat(line.discount_rate || 0);
      const discAmt = Math.round(lineBase * discountRate / 100 * 100) / 100;
      const taxAmt = Math.round((lineBase - discAmt) * taxRate / 100 * 100) / 100;
      const lineTotal = Math.round((lineBase - discAmt + taxAmt) * 100) / 100;

      await connection.execute(`
        INSERT INTO sales_invoice_lines (
          invoice_id, so_line_id, item_id, item_name, quantity, unit_price, line_total,
          tax_rate, tax_amount, discount_rate, discount_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId, line.id, line.item_id, line.item_name, line.quantity_ordered,
        line.unit_price, lineTotal, taxRate, taxAmt, discountRate, discAmt,
      ]);
    }

    logger.info('Sales invoice created on shipment', { soId, invoiceNumber, institutionId, userId });
    return { invoiceId, invoiceNumber, created: true };
  }

  /**
   * Get confirmation summary for a SO
   */
  async getConfirmationSummary(institutionId, soId) {
    try {
      const [soResult] = await db.query(
        `SELECT so.*, w.name as warehouse_name, c.display_name as customer_name
         FROM sales_orders so 
         LEFT JOIN warehouses w ON so.warehouse_id = w.id 
         LEFT JOIN customers c ON so.customer_id = c.id
         WHERE so.institution_id = ? AND so.id = ?`,
        [institutionId, soId]
      );

      if (soResult.length === 0) {
        throw new Error('Sales order not found');
      }

      const so = soResult[0];

      // Get line items with current inventory levels
      const lines = await db.query(
        `SELECT sol.*, i.sku, i.name as item_name, i.unit,
                ip.quantity_on_hand as current_stock,
                ip.quantity_available as available_stock
         FROM sales_order_lines sol
         JOIN items i ON sol.item_id = i.id
         LEFT JOIN inventory_projections ip ON (
              ip.institution_id = sol.institution_id
          AND ip.item_id = sol.item_id
          AND ip.warehouse_id = sol.warehouse_id
          AND (
               (sol.item_variant_id IS NULL AND ip.item_variant_id IS NULL)
            OR (sol.item_variant_id IS NOT NULL AND ip.item_variant_id = sol.item_variant_id)
          )
         )
         WHERE sol.institution_id = ? AND sol.so_id = ?
         ORDER BY sol.line_number`,
        [institutionId, soId]
      );

      return {
        so,
        lines,
        summary: {
          totalItems: lines.length,
          totalQuantity: lines.reduce((sum, line) => sum + line.quantity_ordered, 0),
          totalValue: lines.reduce((sum, line) => sum + (line.quantity_ordered * line.unit_price), 0),
          warehouseName: so.warehouse_name,
          customerName: so.customer_name
        }
      };
    } catch (error) {
      logger.error('Failed to get SO confirmation summary', {
        soId,
        institutionId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new SOConfirmationService();