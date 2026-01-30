const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

/**
 * VendorService - Handles vendor management with normalized database structure
 * 
 * Database Structure:
 * - vendors: Core vendor information
 * - addresses: Billing/shipping addresses (normalized)
 * - bank_details: Banking information (normalized)
 * 
 * Benefits of normalization:
 * - Eliminates data redundancy
 * - Supports multiple addresses/bank accounts per vendor
 * - Easier to maintain and extend
 */
class VendorService {
  /**
   * Create a new vendor with addresses and bank details
   * Uses database transaction to ensure data consistency
   */
  async createVendor(institutionId, vendorData, userId) {
    return await db.transaction(async (connection) => {
      const vendorId = uuidv4();
      const finalVendorCode = vendorData.vendorCode || `VEN-${Date.now()}`;

      // Create core vendor record
      await connection.execute(
        `INSERT INTO vendors 
         (id, institution_id, vendor_code, display_name, company_name, salutation, first_name, 
          last_name, email, work_phone, mobile_phone, pan, gstin, msme_registered, currency, 
          payment_terms, tds, website_url, department, designation, remarks, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [vendorId, institutionId, finalVendorCode, vendorData.displayName, vendorData.companyName, 
         vendorData.salutation, vendorData.firstName, vendorData.lastName, vendorData.email, 
         vendorData.workPhone, vendorData.mobilePhone, vendorData.pan, vendorData.gstin, 
         vendorData.msmeRegistered ? 1 : 0, vendorData.currency, vendorData.paymentTerms, 
         vendorData.tds, vendorData.websiteUrl, vendorData.department, vendorData.designation, 
         vendorData.remarks]
      );

      // Create billing address if provided
      if (vendorData.billingAttention || vendorData.billingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['vendor', vendorId, 'billing', vendorData.billingAttention, vendorData.billingCountry, 
           vendorData.billingAddress1, vendorData.billingAddress2, vendorData.billingCity, 
           vendorData.billingState, vendorData.billingPinCode]
        );
      }
      
      // Create shipping address if provided
      if (vendorData.shippingAttention || vendorData.shippingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['vendor', vendorId, 'shipping', vendorData.shippingAttention, vendorData.shippingCountry, 
           vendorData.shippingAddress1, vendorData.shippingAddress2, vendorData.shippingCity, 
           vendorData.shippingState, vendorData.shippingPinCode]
        );
      }
      
      // Create bank details if provided
      if (vendorData.bankName || vendorData.accountNumber) {
        await connection.execute(
          `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['vendor', vendorId, vendorData.bankName, vendorData.accountHolderName, 
           vendorData.accountNumber, vendorData.ifscCode, vendorData.branchName, 
           vendorData.accountType, vendorData.swiftCode, vendorData.iban]
        );
      }
      
      logger.info('Vendor created', { vendorId, institutionId, displayName: vendorData.displayName, userId });
      return vendorId;
    });
  }

  /**
   * Update vendor with addresses and bank details
   * Uses replace strategy: deletes existing addresses/bank details and recreates them
   */
  async updateVendor(institutionId, vendorId, updateData, userId) {
    return await db.transaction(async (connection) => {
      const updateFields = [];
      const updateValues = [];

      // Define updatable core vendor fields
      const coreFields = [
        'displayName', 'companyName', 'salutation', 'firstName', 'lastName', 'email',
        'workPhone', 'mobilePhone', 'pan', 'gstin', 'msmeRegistered', 'currency',
        'paymentTerms', 'tds', 'websiteUrl', 'department', 'designation', 'remarks', 'status'
      ];

      // Map camelCase frontend fields to snake_case database fields
      const fieldMapping = {
        'displayName': 'display_name',
        'companyName': 'company_name',
        'firstName': 'first_name',
        'lastName': 'last_name',
        'workPhone': 'work_phone',
        'mobilePhone': 'mobile_phone',
        'msmeRegistered': 'msme_registered',
        'paymentTerms': 'payment_terms',
        'websiteUrl': 'website_url'
      };

      // Build dynamic update query for core vendor fields
      for (const field of coreFields) {
        if (updateData[field] !== undefined) {
          const dbField = fieldMapping[field] || field;
          updateFields.push(`${dbField} = ?`);
          updateValues.push(field === 'msmeRegistered' ? (updateData[field] ? 1 : 0) : updateData[field]);
        }
      }

      // Update core vendor fields if any changes
      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(institutionId, vendorId);

        const [result] = await connection.execute(
          `UPDATE vendors SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
          updateValues
        );

        if (result.affectedRows === 0) {
          throw new Error('Vendor not found');
        }
      }
      
      // Replace addresses (delete and recreate)
      await connection.execute('DELETE FROM addresses WHERE entity_type = ? AND entity_id = ?', ['vendor', vendorId]);
      
      if (updateData.billingAttention || updateData.billingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['vendor', vendorId, 'billing', updateData.billingAttention, updateData.billingCountry, 
           updateData.billingAddress1, updateData.billingAddress2, updateData.billingCity, 
           updateData.billingState, updateData.billingPinCode]
        );
      }
      
      if (updateData.shippingAttention || updateData.shippingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['vendor', vendorId, 'shipping', updateData.shippingAttention, updateData.shippingCountry, 
           updateData.shippingAddress1, updateData.shippingAddress2, updateData.shippingCity, 
           updateData.shippingState, updateData.shippingPinCode]
        );
      }
      
      // Replace bank details (delete and recreate)
      await connection.execute('DELETE FROM bank_details WHERE entity_type = ? AND entity_id = ?', ['vendor', vendorId]);
      
      if (updateData.bankName || updateData.accountNumber) {
        await connection.execute(
          `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['vendor', vendorId, updateData.bankName, updateData.accountHolderName, 
           updateData.accountNumber, updateData.ifscCode, updateData.branchName, 
           updateData.accountType, updateData.swiftCode, updateData.iban]
        );
      }
      
      logger.info('Vendor updated', { vendorId, institutionId, userId });
      return true;
    });
  }

  async getVendors(institutionId, filters = {}) {
    let query = 'SELECT * FROM vendors WHERE institution_id = ?';
    const params = [institutionId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      query += ' AND (display_name LIKE ? OR company_name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY display_name';

    return await db.query(query, params);
  }

  /**
   * Get vendor with addresses and bank details
   * Joins data from normalized tables and maps to frontend format
   */
  async getVendor(institutionId, vendorId) {
    const vendors = await db.query(
      'SELECT * FROM vendors WHERE institution_id = ? AND id = ?',
      [institutionId, vendorId]
    );

    if (!vendors[0]) return null;
    
    const vendor = vendors[0];
    
    // Fetch addresses from normalized table
    const addresses = await db.query(
      'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
      ['vendor', vendorId]
    );
    
    // Fetch bank details from normalized table
    const bankDetails = await db.query(
      'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
      ['vendor', vendorId]
    );
    
    // Map addresses back to vendor object for backward compatibility
    addresses.forEach(addr => {
      const prefix = addr.address_type; // 'billing' or 'shipping'
      vendor[`${prefix}_attention`] = addr.attention;
      vendor[`${prefix}_country`] = addr.country;
      vendor[`${prefix}_address1`] = addr.address1;
      vendor[`${prefix}_address2`] = addr.address2;
      vendor[`${prefix}_city`] = addr.city;
      vendor[`${prefix}_state`] = addr.state;
      vendor[`${prefix}_pin_code`] = addr.pin_code;
    });
    
    // Map bank details back to vendor object for backward compatibility
    if (bankDetails[0]) {
      const bank = bankDetails[0];
      vendor.bank_name = bank.bank_name;
      vendor.account_holder_name = bank.account_holder_name;
      vendor.account_number = bank.account_number;
      vendor.ifsc_code = bank.ifsc_code;
      vendor.branch_name = bank.branch_name;
      vendor.account_type = bank.account_type;
      vendor.swift_code = bank.swift_code;
      vendor.iban = bank.iban;
    }
    
    return vendor;
  }

  async getVendorPerformance(institutionId, vendorId, startDate, endDate) {
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
       WHERE po.institution_id = ? AND po.vendor_id = ?
         AND po.order_date BETWEEN ? AND ?`,
      [institutionId, vendorId, startDate, endDate]
    );

    const result = performance[0];
    result.on_time_percentage = result.total_deliveries > 0 
      ? (result.on_time_deliveries / result.total_deliveries) * 100 
      : 0;

    return result;
  }

  async getVendorLeadTimes(institutionId, vendorId) {
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
       WHERE po.institution_id = ? AND po.vendor_id = ?
         AND grn.status = 'confirmed'
         AND po.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY i.id, i.sku, i.name
       HAVING order_count >= 3
       ORDER BY i.name`,
      [institutionId, vendorId]
    );
  }

  async updateVendorLeadTime(institutionId, vendorId, leadTimeDays, userId) {
    const result = await db.query(
      'UPDATE vendors SET lead_time_days = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [leadTimeDays, institutionId, vendorId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Vendor not found');
    }

    logger.info('Vendor lead time updated', { vendorId, institutionId, leadTimeDays, userId });
  }

  // Bank Details Management
  async addVendorBankDetails(institutionId, vendorId, bankData) {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, swiftCode, iban } = bankData;
    
    const bankDetailId = uuidv4();

    await db.query(
      `INSERT INTO vendor_bank_details 
       (id, institution_id, vendor_id, bank_name, account_holder_name, account_number, ifsc_code, account_type, branch_name, swift_code, iban, is_primary, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [bankDetailId, institutionId, vendorId, bankName, accountHolderName, accountNumber, ifscCode || null, accountType || null, branchName || null, swiftCode || null, iban || null, bankData.isPrimary ? 1 : 0]
    );

    logger.info('Vendor bank details added', { bankDetailId, vendorId, institutionId });
    return bankDetailId;
  }

  async getVendorBankDetails(institutionId, vendorId) {
    return await db.query(
      'SELECT * FROM vendor_bank_details WHERE institution_id = ? AND vendor_id = ? ORDER BY is_primary DESC, created_at ASC',
      [institutionId, vendorId]
    );
  }

  async updateVendorBankDetails(institutionId, bankDetailId, bankData) {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, swiftCode, iban } = bankData;

    const result = await db.query(
      `UPDATE vendor_bank_details 
       SET bank_name = ?, account_holder_name = ?, account_number = ?, ifsc_code = ?, account_type = ?, branch_name = ?, swift_code = ?, iban = ?, is_primary = ?, updated_at = NOW()
       WHERE id = ? AND institution_id = ?`,
      [bankName, accountHolderName, accountNumber, ifscCode || null, accountType || null, branchName || null, swiftCode || null, iban || null, bankData.isPrimary ? 1 : 0, bankDetailId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Bank details not found');
    }

    logger.info('Vendor bank details updated', { bankDetailId, institutionId });
    return true;
  }

  async deleteVendorBankDetails(institutionId, bankDetailId) {
    const result = await db.query(
      'DELETE FROM vendor_bank_details WHERE id = ? AND institution_id = ?',
      [bankDetailId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Bank details not found');
    }

    logger.info('Vendor bank details deleted', { bankDetailId, institutionId });
    return true;
  }

}

module.exports = new VendorService();