const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const { normalizeGstin, normalizePan } = require('../../utils/gstinUtils');

class CustomerService {
  constructor() {
    this._hasCustomerBankDetailsTable = null;
  }

  isMissingTableError(error) {
    return Boolean(error && (error.errno === 1146 || error.code === 'ER_NO_SUCH_TABLE'));
  }

  async hasCustomerBankDetailsTable() {
    if (this._hasCustomerBankDetailsTable != null) return this._hasCustomerBankDetailsTable;
    const rows = await db.query(
      `SELECT 1 as ok
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'customer_bank_details'
        LIMIT 1`
    );
    this._hasCustomerBankDetailsTable = Array.isArray(rows) ? rows.length > 0 : Boolean(rows);
    return this._hasCustomerBankDetailsTable;
  }

  hasAnyAddressValue(address = {}) {
    if (!address || typeof address !== 'object') return false;
    const fields = ['attention', 'country', 'address1', 'address2', 'city', 'state', 'pin_code'];
    return fields.some((field) => {
      const value = address[field];
      return value != null && String(value).trim() !== '';
    });
  }

  normalizeAddressInput(address = {}, fallback = {}) {
    return {
      attention: address.attention ?? fallback.attention ?? null,
      country: address.country ?? fallback.country ?? null,
      address1: address.address1 ?? fallback.address1 ?? null,
      address2: address.address2 ?? fallback.address2 ?? null,
      city: address.city ?? fallback.city ?? null,
      state: address.state ?? fallback.state ?? null,
      pin_code: address.pin_code ?? fallback.pin_code ?? null,
    };
  }

  normalizeBankInput(bank = {}, fallback = {}) {
    return {
      bank_name: bank.bank_name ?? bank.bankName ?? fallback.bank_name ?? fallback.bankName ?? null,
      account_holder_name: bank.account_holder_name ?? bank.accountHolderName ?? fallback.account_holder_name ?? fallback.accountHolderName ?? null,
      account_number: bank.account_number ?? bank.accountNumber ?? fallback.account_number ?? fallback.accountNumber ?? null,
      ifsc_code: bank.ifsc_code ?? bank.ifscCode ?? fallback.ifsc_code ?? fallback.ifscCode ?? null,
      branch_name: bank.branch_name ?? bank.branchName ?? fallback.branch_name ?? fallback.branchName ?? null,
      account_type: bank.account_type ?? bank.accountType ?? fallback.account_type ?? fallback.accountType ?? null,
      swift_code: bank.swift_code ?? bank.swiftCode ?? fallback.swift_code ?? fallback.swiftCode ?? null,
      iban: bank.iban ?? fallback.iban ?? null,
    };
  }

  hasAnyBankValue(bank = {}) {
    if (!bank || typeof bank !== 'object') return false;
    const fields = ['bank_name', 'account_holder_name', 'account_number', 'ifsc_code', 'branch_name', 'account_type', 'swift_code', 'iban'];
    return fields.some((field) => bank[field] != null && String(bank[field]).trim() !== '');
  }

  async insertBankDetails(connection, institutionId, customerId, inputData = {}) {
    const primaryBank = this.normalizeBankInput({}, inputData);
    const extraBanks = Array.isArray(inputData.bankDetails)
      ? inputData.bankDetails.map((bank) => this.normalizeBankInput(bank))
      : [];
    const selectedPrimaryKey = inputData.defaultBankDetailKey || 'primary';
    const merged = [
      { ...primaryBank, _key: 'primary' },
      ...extraBanks.map((bank, idx) => ({ ...bank, _key: `extra_${idx}` })),
    ].filter((bank) => this.hasAnyBankValue(bank));
    const ordered = [
      ...merged.filter((bank) => bank._key === selectedPrimaryKey),
      ...merged.filter((bank) => bank._key !== selectedPrimaryKey),
    ];
    const fallbackPrimary = this.hasAnyBankValue(primaryBank) ? primaryBank : null;
    const bankToPersist = ordered[0] || fallbackPrimary;

    const hasMultiBankTable = await this.hasCustomerBankDetailsTable();
    if (hasMultiBankTable) {
      await connection.execute('DELETE FROM customer_bank_details WHERE institution_id = ? AND customer_id = ?', [institutionId, customerId]);
      for (let idx = 0; idx < ordered.length; idx += 1) {
        const bank = ordered[idx];
        await connection.execute(
          `INSERT INTO customer_bank_details 
           (id, institution_id, customer_id, bank_name, account_holder_name, account_number, ifsc_code, account_type, branch_name, swift_code, iban, is_primary, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [uuidv4(), institutionId, customerId, bank.bank_name, bank.account_holder_name, bank.account_number, bank.ifsc_code, bank.account_type, bank.branch_name, bank.swift_code, bank.iban, idx === 0 ? 1 : 0]
        );
      }
    } else {
      logger.warn('customer_bank_details table missing; using legacy bank_details only', { institutionId, customerId });
    }

    if (!bankToPersist) {
      // Do not wipe existing bank details when no bank payload is provided.
      return;
    }

    await connection.execute('DELETE FROM bank_details WHERE entity_type = ? AND entity_id = ?', ['customer', customerId]);
    if (bankToPersist) {
      const primary = bankToPersist;
      await connection.execute(
        `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['customer', customerId, primary.bank_name, primary.account_holder_name, primary.account_number, primary.ifsc_code, primary.branch_name, primary.account_type, primary.swift_code, primary.iban]
      );
    }
  }

  async insertAddresses(connection, entityType, entityId, inputData = {}) {
    const billingFallback = this.normalizeAddressInput({}, {
      attention: inputData.billingAttention,
      country: inputData.billingCountry,
      address1: inputData.billingAddress1,
      address2: inputData.billingAddress2,
      city: inputData.billingCity,
      state: inputData.billingState,
      pin_code: inputData.billingPinCode,
    });
    const shippingFallback = this.normalizeAddressInput({}, {
      attention: inputData.shippingAttention,
      country: inputData.shippingCountry,
      address1: inputData.shippingAddress1,
      address2: inputData.shippingAddress2,
      city: inputData.shippingCity,
      state: inputData.shippingState,
      pin_code: inputData.shippingPinCode,
    });

    const billingAddresses = Array.isArray(inputData.billingAddresses) && inputData.billingAddresses.length > 0
      ? inputData.billingAddresses.map((addr) => this.normalizeAddressInput(addr))
      : [billingFallback];
    const shippingAddresses = Array.isArray(inputData.shippingAddresses) && inputData.shippingAddresses.length > 0
      ? inputData.shippingAddresses.map((addr) => this.normalizeAddressInput(addr))
      : [shippingFallback];
    const addressesToInsert = [
      ...billingAddresses.map((addr) => ({ ...addr, addressType: 'billing' })),
      ...shippingAddresses.map((addr) => ({ ...addr, addressType: 'shipping' })),
    ].filter((addr) => this.hasAnyAddressValue(addr));

    for (const addr of addressesToInsert) {
      await connection.execute(
        `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entityType, entityId, addr.addressType, addr.attention, addr.country, addr.address1, addr.address2, addr.city, addr.state, addr.pin_code]
      );
    }
  }

  async ensureColumns() {
    try { await db.query('ALTER TABLE customers ADD COLUMN price_list_id VARCHAR(36) DEFAULT NULL'); } catch (e) {
      if (e.errno !== 1060) throw e;
    }
    try {
      await db.query(
        "ALTER TABLE customers ADD COLUMN gstin VARCHAR(20) NULL COMMENT 'GST identification number' AFTER pan"
      );
    } catch (e) {
      if (e.errno !== 1060) throw e;
    }
  }

  async createCustomer(institutionId, customerData, userId) {
    await this.ensureColumns();
    return await db.transaction(async (connection) => {
      const customerId = uuidv4();
      const finalCustomerCode = customerData.customerCode || `CUS-${Date.now()}`;

      // Create customer record
      await connection.execute(
        `INSERT INTO customers 
         (id, institution_id, customer_code, display_name, company_name, salutation, first_name, 
          last_name, email, work_phone, mobile_phone, pan, gstin, msme_registered, currency, 
          payment_terms, tds, website_url, department, designation, remarks, credit_limit, price_list_id, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [customerId, institutionId, finalCustomerCode, customerData.displayName, customerData.companyName, 
         customerData.salutation, customerData.firstName, customerData.lastName, customerData.email, 
         customerData.workPhone, customerData.mobilePhone, normalizePan(customerData.pan),
         normalizeGstin(customerData.gstin), 
         customerData.msmeRegistered ? 1 : 0, customerData.currency, customerData.paymentTerms, 
         customerData.tds, customerData.websiteUrl, customerData.department, customerData.designation, 
         customerData.remarks, customerData.creditLimit || 0, customerData.priceListId || null]
      );

      // Create addresses (supports multiple billing/shipping addresses)
      await this.insertAddresses(connection, 'customer', customerId, customerData);
      
      await this.insertBankDetails(connection, institutionId, customerId, customerData);
      
      logger.info('Customer created', { customerId, institutionId, displayName: customerData.displayName, userId });
      return customerId;
    });
  }

  async updateCustomer(institutionId, customerId, updateData, userId) {
    return await db.transaction(async (connection) => {
      const updateFields = [];
      const updateValues = [];

      // Core customer fields
      const coreFields = [
        'displayName', 'companyName', 'salutation', 'firstName', 'lastName', 'email',
        'workPhone', 'mobilePhone', 'pan', 'gstin', 'msmeRegistered', 'currency',
        'paymentTerms', 'tds', 'websiteUrl', 'department', 'designation', 'remarks', 
        'status', 'creditLimit', 'priceListId'
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
        'creditLimit': 'credit_limit',
        'priceListId': 'price_list_id'
      };

      for (const field of coreFields) {
        if (updateData[field] !== undefined) {
          const dbField = fieldMapping[field] || field;
          updateFields.push(`${dbField} = ?`);
          let value = updateData[field];
          if (field === 'msmeRegistered') value = updateData[field] ? 1 : 0;
          else if (field === 'gstin') value = normalizeGstin(updateData[field]);
          else if (field === 'pan') value = normalizePan(updateData[field]);
          updateValues.push(value);
        }
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(institutionId, customerId);

        const [result] = await connection.execute(
          `UPDATE customers SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
          updateValues
        );

        if (result.affectedRows === 0) {
          throw new Error('Customer not found');
        }
      }
      
      // Update addresses
      await connection.execute('DELETE FROM addresses WHERE entity_type = ? AND entity_id = ?', ['customer', customerId]);
      
      await this.insertAddresses(connection, 'customer', customerId, updateData);
      
      await this.insertBankDetails(connection, institutionId, customerId, updateData);
      
      logger.info('Customer updated', { customerId, institutionId, userId });
      return true;
    });
  }

  async getCustomers(institutionId, filters = {}) {
    let query = 'SELECT * FROM customers WHERE institution_id = ?';
    const params = [institutionId];

    if (filters.status === 'all') {
      // no status filter
    } else {
      query += ' AND status = ?';
      params.push(filters.status || 'active');
    }

    if (filters.search) {
      query += ' AND (display_name LIKE ? OR company_name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY display_name';

    return await db.query(query, params);
  }

  async getCustomer(institutionId, customerId) {
    const customers = await db.query(
      `SELECT * FROM customers
        WHERE institution_id COLLATE utf8mb4_unicode_ci = ?
          AND id COLLATE utf8mb4_unicode_ci = ?`,
      [institutionId, customerId]
    );

    const customer = Array.isArray(customers) ? customers[0] : customers;
    if (!customer) return null;

    const { loadCustomerAddressesFromTable } = require('../../utils/partyAddressLoader');
    const { billing, shipping } = await loadCustomerAddressesFromTable(customerId);

    customer.billing_attention = billing.attention;
    customer.billing_country = billing.country;
    customer.billing_address1 = billing.line1;
    customer.billing_address2 = billing.line2;
    customer.billing_city = billing.city;
    customer.billing_state = billing.state;
    customer.billing_pin_code = billing.postalCode;

    customer.shipping_attention = shipping.attention;
    customer.shipping_country = shipping.country;
    customer.shipping_address1 = shipping.line1;
    customer.shipping_address2 = shipping.line2;
    customer.shipping_city = shipping.city;
    customer.shipping_state = shipping.state;
    customer.shipping_pin_code = shipping.postalCode;

    // Legacy path: also read addresses table directly if loader returned empty
    const addresses = await db.query(
      `SELECT * FROM addresses
        WHERE entity_type = 'customer'
          AND entity_id COLLATE utf8mb4_unicode_ci = CAST(? AS CHAR) COLLATE utf8mb4_unicode_ci
        ORDER BY id ASC`,
      [customerId]
    );
    
    let customerBanks = [];
    if (await this.hasCustomerBankDetailsTable()) {
      customerBanks = await db.query(
        'SELECT * FROM customer_bank_details WHERE institution_id = ? AND customer_id = ? ORDER BY is_primary DESC, created_at ASC',
        [institutionId, customerId]
      );
    }
    const legacyBanks = await db.query(
      'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
      ['customer', customerId]
    );
    
    const addressList = Array.isArray(addresses) ? addresses : addresses ? [addresses] : [];
    customer.billing_addresses = [];
    customer.shipping_addresses = [];
    addressList.forEach((addr) => {
      const prefix = String(addr.address_type || '').toLowerCase();
      if (prefix !== 'billing' && prefix !== 'shipping') return;
      const normalizedAddress = {
        id: addr.id != null ? String(addr.id) : null,
        attention: addr.attention || '',
        country: addr.country || '',
        address1: addr.address1 || '',
        address2: addr.address2 || '',
        city: addr.city || '',
        state: addr.state || '',
        pin_code: addr.pin_code || '',
      };
      customer[`${prefix}_addresses`].push(normalizedAddress);
    });

    // Flat "primary" fields must mirror the FIRST address of each list. The edit
    // form treats these as the primary and `*_addresses.slice(1)` as extras; if the
    // primary points at a different row (e.g. the loader's last-wins merge), re-saving
    // drops the real first address and duplicates another. Keep them in sync here.
    ['billing', 'shipping'].forEach((prefix) => {
      const first = customer[`${prefix}_addresses`][0];
      if (!first) return;
      customer[`${prefix}_attention`] = first.attention;
      customer[`${prefix}_country`] = first.country;
      customer[`${prefix}_address1`] = first.address1;
      customer[`${prefix}_address2`] = first.address2;
      customer[`${prefix}_city`] = first.city;
      customer[`${prefix}_state`] = first.state;
      customer[`${prefix}_pin_code`] = first.pin_code;
    });
    
    const bankListRaw = Array.isArray(customerBanks) && customerBanks.length > 0 ? customerBanks : (Array.isArray(legacyBanks) ? legacyBanks : []);
    customer.bank_details = bankListRaw.map((bank, idx) => ({
      id: bank.id != null ? String(bank.id) : null,
      bank_name: bank.bank_name || '',
      account_holder_name: bank.account_holder_name || '',
      account_number: bank.account_number || '',
      ifsc_code: bank.ifsc_code || '',
      branch_name: bank.branch_name || '',
      account_type: bank.account_type || '',
      swift_code: bank.swift_code || '',
      iban: bank.iban || '',
      is_primary: Number(bank.is_primary || 0) === 1 || idx === 0,
    }));

    // Map primary bank details to backward-compatible top-level fields
    if (customer.bank_details[0]) {
      const bank = customer.bank_details[0];
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

  async getCustomerPerformance(institutionId, customerId, startDate, endDate) {
    const performance = await db.query(
      `SELECT 
         COUNT(so.id) as total_orders,
         AVG(DATEDIFF(so.expected_ship_date, so.order_date)) as avg_delivery_days,
         COUNT(CASE WHEN so.status = 'delivered' THEN 1 END) as delivered_orders,
         COUNT(so.id) as total_orders_count,
         SUM(so.total_amount) as total_value
       FROM sales_orders so
       WHERE so.institution_id = ? AND so.customer_id = ?
         AND so.order_date BETWEEN ? AND ?`,
      [institutionId, customerId, startDate, endDate]
    );

    const result = performance[0];
    result.delivery_percentage = result.total_orders_count > 0 
      ? (result.delivered_orders / result.total_orders_count) * 100 
      : 0;

    return result;
  }

  // Bank Details Management
  async addCustomerBankDetails(institutionId, customerId, bankData) {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, swiftCode, iban } = bankData;
    
    const bankDetailId = uuidv4();

    if (!(await this.hasCustomerBankDetailsTable())) {
      throw new Error('Multiple bank accounts are unavailable because customer_bank_details table is missing');
    }
    await db.query(
      `INSERT INTO customer_bank_details 
       (id, institution_id, customer_id, bank_name, account_holder_name, account_number, ifsc_code, account_type, branch_name, swift_code, iban, is_primary, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [bankDetailId, institutionId, customerId, bankName, accountHolderName, accountNumber, ifscCode || null, accountType || null, branchName || null, swiftCode || null, iban || null, bankData.isPrimary ? 1 : 0]
    );

    logger.info('Customer bank details added', { bankDetailId, customerId, institutionId });
    return bankDetailId;
  }

  async getCustomerBankDetails(institutionId, customerId) {
    if (!(await this.hasCustomerBankDetailsTable())) {
      return [];
    }
    return await db.query(
      'SELECT * FROM customer_bank_details WHERE institution_id = ? AND customer_id = ? ORDER BY is_primary DESC, created_at ASC',
      [institutionId, customerId]
    );
  }

  async updateCustomerBankDetails(institutionId, bankDetailId, bankData) {
    const { bankName, accountHolderName, accountNumber, ifscCode, accountType, branchName, swiftCode, iban } = bankData;

    if (!(await this.hasCustomerBankDetailsTable())) {
      throw new Error('Multiple bank accounts are unavailable because customer_bank_details table is missing');
    }
    const result = await db.query(
      `UPDATE customer_bank_details 
       SET bank_name = ?, account_holder_name = ?, account_number = ?, ifsc_code = ?, account_type = ?, branch_name = ?, swift_code = ?, iban = ?, is_primary = ?, updated_at = NOW()
       WHERE id = ? AND institution_id = ?`,
      [bankName, accountHolderName, accountNumber, ifscCode || null, accountType || null, branchName || null, swiftCode || null, iban || null, bankData.isPrimary ? 1 : 0, bankDetailId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Bank details not found');
    }

    logger.info('Customer bank details updated', { bankDetailId, institutionId });
    return true;
  }

  async deleteCustomerBankDetails(institutionId, bankDetailId) {
    if (!(await this.hasCustomerBankDetailsTable())) {
      throw new Error('Multiple bank accounts are unavailable because customer_bank_details table is missing');
    }
    const result = await db.query(
      'DELETE FROM customer_bank_details WHERE id = ? AND institution_id = ?',
      [bankDetailId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Bank details not found');
    }

    logger.info('Customer bank details deleted', { bankDetailId, institutionId });
    return true;
  }
}

module.exports = new CustomerService();