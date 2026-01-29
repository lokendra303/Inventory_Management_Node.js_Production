const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class CustomerService {
  async createCustomer(tenantId, customerData, userId) {
    return await db.transaction(async (connection) => {
      const customerId = uuidv4();
      const finalCustomerCode = customerData.customerCode || `CUS-${Date.now()}`;

      // Create customer record
      await connection.execute(
        `INSERT INTO customers 
         (id, tenant_id, customer_code, display_name, company_name, salutation, first_name, 
          last_name, email, work_phone, mobile_phone, pan, gstin, msme_registered, currency, 
          payment_terms, tds, website_url, department, designation, remarks, credit_limit, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [customerId, tenantId, finalCustomerCode, customerData.displayName, customerData.companyName, 
         customerData.salutation, customerData.firstName, customerData.lastName, customerData.email, 
         customerData.workPhone, customerData.mobilePhone, customerData.pan, customerData.gstin, 
         customerData.msmeRegistered ? 1 : 0, customerData.currency, customerData.paymentTerms, 
         customerData.tds, customerData.websiteUrl, customerData.department, customerData.designation, 
         customerData.remarks, customerData.creditLimit || 0]
      );

      // Create addresses
      if (customerData.billingAttention || customerData.billingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['customer', customerId, 'billing', customerData.billingAttention, customerData.billingCountry, 
           customerData.billingAddress1, customerData.billingAddress2, customerData.billingCity, 
           customerData.billingState, customerData.billingPinCode]
        );
      }
      
      if (customerData.shippingAttention || customerData.shippingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['customer', customerId, 'shipping', customerData.shippingAttention, customerData.shippingCountry, 
           customerData.shippingAddress1, customerData.shippingAddress2, customerData.shippingCity, 
           customerData.shippingState, customerData.shippingPinCode]
        );
      }
      
      // Create bank details
      if (customerData.bankName || customerData.accountNumber) {
        await connection.execute(
          `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['customer', customerId, customerData.bankName, customerData.accountHolderName, 
           customerData.accountNumber, customerData.ifscCode, customerData.branchName, 
           customerData.accountType, customerData.swiftCode, customerData.iban]
        );
      }
      
      logger.info('Customer created', { customerId, tenantId, displayName: customerData.displayName, userId });
      return customerId;
    });
  }

  async updateCustomer(tenantId, customerId, updateData, userId) {
    return await db.transaction(async (connection) => {
      const updateFields = [];
      const updateValues = [];

      // Core customer fields
      const coreFields = [
        'displayName', 'companyName', 'salutation', 'firstName', 'lastName', 'email',
        'workPhone', 'mobilePhone', 'pan', 'gstin', 'msmeRegistered', 'currency',
        'paymentTerms', 'tds', 'websiteUrl', 'department', 'designation', 'remarks', 
        'status', 'creditLimit'
      ];

      const fieldMapping = {
        'displayName': 'display_name',
        'companyName': 'company_name',
        'firstName': 'first_name',
        'lastName': 'last_name',
        'workPhone': 'work_phone',
        'mobilePhone': 'mobile_phone',
        'msmeRegistered': 'msme_registered',
        'paymentTerms': 'payment_terms',
        'websiteUrl': 'website_url',
        'creditLimit': 'credit_limit'
      };

      for (const field of coreFields) {
        if (updateData[field] !== undefined) {
          const dbField = fieldMapping[field] || field;
          updateFields.push(`${dbField} = ?`);
          updateValues.push(field === 'msmeRegistered' ? (updateData[field] ? 1 : 0) : updateData[field]);
        }
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(tenantId, customerId);

        const [result] = await connection.execute(
          `UPDATE customers SET ${updateFields.join(', ')} WHERE tenant_id = ? AND id = ?`,
          updateValues
        );

        if (result.affectedRows === 0) {
          throw new Error('Customer not found');
        }
      }
      
      // Update addresses
      await connection.execute('DELETE FROM addresses WHERE entity_type = ? AND entity_id = ?', ['customer', customerId]);
      
      if (updateData.billingAttention || updateData.billingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['customer', customerId, 'billing', updateData.billingAttention, updateData.billingCountry, 
           updateData.billingAddress1, updateData.billingAddress2, updateData.billingCity, 
           updateData.billingState, updateData.billingPinCode]
        );
      }
      
      if (updateData.shippingAttention || updateData.shippingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['customer', customerId, 'shipping', updateData.shippingAttention, updateData.shippingCountry, 
           updateData.shippingAddress1, updateData.shippingAddress2, updateData.shippingCity, 
           updateData.shippingState, updateData.shippingPinCode]
        );
      }
      
      // Update bank details
      await connection.execute('DELETE FROM bank_details WHERE entity_type = ? AND entity_id = ?', ['customer', customerId]);
      
      if (updateData.bankName || updateData.accountNumber) {
        await connection.execute(
          `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['customer', customerId, updateData.bankName, updateData.accountHolderName, 
           updateData.accountNumber, updateData.ifscCode, updateData.branchName, 
           updateData.accountType, updateData.swiftCode, updateData.iban]
        );
      }
      
      logger.info('Customer updated', { customerId, tenantId, userId });
      return true;
    });
  }

  async getCustomers(tenantId, filters = {}) {
    let query = 'SELECT * FROM customers WHERE tenant_id = ?';
    const params = [tenantId];

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

  async getCustomer(tenantId, customerId) {
    const customers = await db.query(
      'SELECT * FROM customers WHERE tenant_id = ? AND id = ?',
      [tenantId, customerId]
    );

    if (!customers[0]) return null;
    
    const customer = customers[0];
    
    // Get addresses
    const addresses = await db.query(
      'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
      ['customer', customerId]
    );
    
    // Get bank details
    const bankDetails = await db.query(
      'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
      ['customer', customerId]
    );
    
    // Map addresses
    addresses.forEach(addr => {
      const prefix = addr.address_type;
      customer[`${prefix}_attention`] = addr.attention;
      customer[`${prefix}_country`] = addr.country;
      customer[`${prefix}_address1`] = addr.address1;
      customer[`${prefix}_address2`] = addr.address2;
      customer[`${prefix}_city`] = addr.city;
      customer[`${prefix}_state`] = addr.state;
      customer[`${prefix}_pin_code`] = addr.pin_code;
    });
    
    // Map bank details
    if (bankDetails[0]) {
      const bank = bankDetails[0];
      customer.bank_name = bank.bank_name;
      customer.account_holder_name = bank.account_holder_name;
      customer.account_number = bank.account_number;
      customer.ifsc_code = bank.ifsc_code;
      customer.branch_name = bank.branch_name;
      customer.account_type = bank.account_type;
      customer.swift_code = bank.swift_code;
      customer.iban = bank.iban;
    }
    
    return customer;
  }

  async getCustomerPerformance(tenantId, customerId, startDate, endDate) {
    const performance = await db.query(
      `SELECT 
         COUNT(so.id) as total_orders,
         AVG(DATEDIFF(so.expected_ship_date, so.order_date)) as avg_delivery_days,
         COUNT(CASE WHEN so.status = 'delivered' THEN 1 END) as delivered_orders,
         COUNT(so.id) as total_orders_count,
         SUM(so.total_amount) as total_value
       FROM sales_orders so
       WHERE so.tenant_id = ? AND so.customer_id = ?
         AND so.order_date BETWEEN ? AND ?`,
      [tenantId, customerId, startDate, endDate]
    );

    const result = performance[0];
    result.delivery_percentage = result.total_orders_count > 0 
      ? (result.delivered_orders / result.total_orders_count) * 100 
      : 0;

    return result;
  }

  // Bank Details Management
  async addCustomerBankDetails(tenantId, customerId, bankData) {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, swiftCode, iban } = bankData;
    
    const bankDetailId = uuidv4();

    await db.query(
      `INSERT INTO customer_bank_details 
       (id, tenant_id, customer_id, bank_name, account_holder_name, account_number, ifsc_code, account_type, branch_name, swift_code, iban, is_primary, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [bankDetailId, tenantId, customerId, bankName, accountHolderName, accountNumber, ifscCode || null, accountType || null, branchName || null, swiftCode || null, iban || null, bankData.isPrimary ? 1 : 0]
    );

    logger.info('Customer bank details added', { bankDetailId, customerId, tenantId });
    return bankDetailId;
  }

  async getCustomerBankDetails(tenantId, customerId) {
    return await db.query(
      'SELECT * FROM customer_bank_details WHERE tenant_id = ? AND customer_id = ? ORDER BY is_primary DESC, created_at ASC',
      [tenantId, customerId]
    );
  }

  async updateCustomerBankDetails(tenantId, bankDetailId, bankData) {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, swiftCode, iban } = bankData;

    const result = await db.query(
      `UPDATE customer_bank_details 
       SET bank_name = ?, account_holder_name = ?, account_number = ?, ifsc_code = ?, account_type = ?, branch_name = ?, swift_code = ?, iban = ?, is_primary = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [bankName, accountHolderName, accountNumber, ifscCode || null, accountType || null, branchName || null, swiftCode || null, iban || null, bankData.isPrimary ? 1 : 0, bankDetailId, tenantId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Bank details not found');
    }

    logger.info('Customer bank details updated', { bankDetailId, tenantId });
    return true;
  }

  async deleteCustomerBankDetails(tenantId, bankDetailId) {
    const result = await db.query(
      'DELETE FROM customer_bank_details WHERE id = ? AND tenant_id = ?',
      [bankDetailId, tenantId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Bank details not found');
    }

    logger.info('Customer bank details deleted', { bankDetailId, tenantId });
    return true;
  }
}

module.exports = new CustomerService();