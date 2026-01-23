const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class VendorService {
  async createVendor(tenantId, vendorData, userId) {
    const {
      vendorCode,
      name,
      contactPerson,
      email,
      phone,
      address,
      paymentTerms,
      leadTimeDays = 7,
      currency = 'USD'
    } = vendorData;

    const vendorId = uuidv4();

    await db.query(
      `INSERT INTO vendors 
       (id, tenant_id, vendor_code, name, contact_person, email, phone, address, 
        payment_terms, lead_time_days, currency, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [vendorId, tenantId, vendorCode, name, contactPerson, email, phone, address, 
       paymentTerms, leadTimeDays, currency]
    );

    logger.info('Vendor created', { vendorId, tenantId, vendorCode, userId });
    return vendorId;
  }

  async updateVendor(tenantId, vendorId, updateData, userId) {
    const {
      name,
      contactPerson,
      email,
      phone,
      address,
      paymentTerms,
      leadTimeDays,
      currency,
      status
    } = updateData;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (contactPerson !== undefined) {
      updateFields.push('contact_person = ?');
      updateValues.push(contactPerson);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (paymentTerms !== undefined) {
      updateFields.push('payment_terms = ?');
      updateValues.push(paymentTerms);
    }
    if (leadTimeDays !== undefined) {
      updateFields.push('lead_time_days = ?');
      updateValues.push(leadTimeDays);
    }
    if (currency !== undefined) {
      updateFields.push('currency = ?');
      updateValues.push(currency);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(tenantId, vendorId);

    const result = await db.query(
      `UPDATE vendors SET ${updateFields.join(', ')} WHERE tenant_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('Vendor not found');
    }

    logger.info('Vendor updated', { vendorId, tenantId, userId });
  }

  async getVendors(tenantId, filters = {}) {
    let query = 'SELECT * FROM vendors WHERE tenant_id = ?';
    const params = [tenantId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (name LIKE ? OR vendor_code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY name';

    return await db.query(query, params);
  }

  async getVendor(tenantId, vendorId) {
    const vendors = await db.query(
      'SELECT * FROM vendors WHERE tenant_id = ? AND id = ?',
      [tenantId, vendorId]
    );

    return vendors[0] || null;
  }

  async getVendorPerformance(tenantId, vendorId, startDate, endDate) {
    // Get delivery performance metrics
    const performance = await db.query(
      `SELECT 
         COUNT(po.id) as total_orders,
         AVG(DATEDIFF(grn.receipt_date, po.order_date)) as avg_delivery_days,
         COUNT(CASE WHEN grn.receipt_date <= pol.expected_date THEN 1 END) as on_time_deliveries,
         COUNT(grn.id) as total_deliveries,
         SUM(po.total_amount) as total_value
       FROM purchase_orders po
       LEFT JOIN goods_receipt_notes grn ON po.id = grn.po_id
       LEFT JOIN purchase_order_lines pol ON po.id = pol.po_id
       WHERE po.tenant_id = ? AND po.vendor_id = ?
         AND po.order_date BETWEEN ? AND ?`,
      [tenantId, vendorId, startDate, endDate]
    );

    const result = performance[0];
    result.on_time_percentage = result.total_deliveries > 0 
      ? (result.on_time_deliveries / result.total_deliveries) * 100 
      : 0;

    return result;
  }

  async getVendorLeadTimes(tenantId, vendorId) {
    // Get historical lead times for forecasting
    return await db.query(
      `SELECT 
         i.id as item_id,
         i.sku,
         i.name as item_name,
         AVG(DATEDIFF(grn.receipt_date, po.order_date)) as avg_lead_time_days,
         MIN(DATEDIFF(grn.receipt_date, po.order_date)) as min_lead_time_days,
         MAX(DATEDIFF(grn.receipt_date, po.order_date)) as max_lead_time_days,
         COUNT(*) as order_count
       FROM purchase_orders po
       JOIN purchase_order_lines pol ON po.id = pol.po_id
       JOIN items i ON pol.item_id = i.id
       JOIN goods_receipt_notes grn ON po.id = grn.po_id
       WHERE po.tenant_id = ? AND po.vendor_id = ?
         AND grn.status = 'confirmed'
         AND po.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY i.id, i.sku, i.name
       HAVING order_count >= 3
       ORDER BY i.name`,
      [tenantId, vendorId]
    );
  }

  async updateVendorLeadTime(tenantId, vendorId, leadTimeDays, userId) {
    const result = await db.query(
      'UPDATE vendors SET lead_time_days = ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?',
      [leadTimeDays, tenantId, vendorId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Vendor not found');
    }

    logger.info('Vendor lead time updated', { vendorId, tenantId, leadTimeDays, userId });
  }
}

module.exports = new VendorService();