const mysql = require('mysql2/promise');
const config = require('../config');

/**
 * Database Normalization Script
 * 
 * This script normalizes the database by:
 * 1. Creating separate tables for addresses and bank details
 * 2. Migrating existing data from vendors/customers tables
 * 3. Removing redundant columns from original tables
 * 
 * Run once during deployment: node src/scripts/normalize-tables.js
 */

const dbConfig = {
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
};

async function normalizeDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('Starting database normalization...');

    // Create normalized addresses table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type ENUM('vendor', 'customer') NOT NULL,
        entity_id VARCHAR(36) NOT NULL,
        address_type ENUM('billing', 'shipping') NOT NULL,
        attention VARCHAR(255),
        country VARCHAR(100),
        address1 TEXT,
        address2 TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pin_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_address_type (address_type)
      )
    `);

    // Create normalized bank_details table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bank_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type ENUM('vendor', 'customer') NOT NULL,
        entity_id VARCHAR(36) NOT NULL,
        bank_name VARCHAR(255),
        account_holder_name VARCHAR(255),
        account_number VARCHAR(50),
        ifsc_code VARCHAR(20),
        branch_name VARCHAR(255),
        account_type ENUM('savings', 'current', 'cc', 'od'),
        swift_code VARCHAR(20),
        iban VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_entity (entity_type, entity_id)
      )
    `);

    // Migrate vendor addresses
    const vendors = await connection.execute('SELECT * FROM vendors');
    for (const vendor of vendors[0]) {
      // Billing address
      if (vendor.billing_attention || vendor.billing_address1) {
        await connection.execute(`
          INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['vendor', vendor.id, 'billing', vendor.billing_attention, vendor.billing_country, vendor.billing_address1, vendor.billing_address2, vendor.billing_city, vendor.billing_state, vendor.billing_pin_code]);
      }

      // Shipping address
      if (vendor.shipping_attention || vendor.shipping_address1) {
        await connection.execute(`
          INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['vendor', vendor.id, 'shipping', vendor.shipping_attention, vendor.shipping_country, vendor.shipping_address1, vendor.shipping_address2, vendor.shipping_city, vendor.shipping_state, vendor.shipping_pin_code]);
      }

      // Bank details
      if (vendor.bank_name || vendor.account_number) {
        await connection.execute(`
          INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['vendor', vendor.id, vendor.bank_name, vendor.account_holder_name, vendor.account_number, vendor.ifsc_code, vendor.branch_name, vendor.account_type, vendor.swift_code, vendor.iban]);
      }
    }

    // Migrate customer addresses and bank details
    const customers = await connection.execute('SELECT * FROM customers');
    for (const customer of customers[0]) {
      // Billing address
      if (customer.billing_attention || customer.billing_address1) {
        await connection.execute(`
          INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['customer', customer.id, 'billing', customer.billing_attention, customer.billing_country, customer.billing_address1, customer.billing_address2, customer.billing_city, customer.billing_state, customer.billing_pin_code]);
      }

      // Shipping address
      if (customer.shipping_attention || customer.shipping_address1) {
        await connection.execute(`
          INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['customer', customer.id, 'shipping', customer.shipping_attention, customer.shipping_country, customer.shipping_address1, customer.shipping_address2, customer.shipping_city, customer.shipping_state, customer.shipping_pin_code]);
      }

      // Bank details
      if (customer.bank_name || customer.account_number) {
        await connection.execute(`
          INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['customer', customer.id, customer.bank_name, customer.account_holder_name, customer.account_number, customer.ifsc_code, customer.branch_name, customer.account_type, customer.swift_code, customer.iban]);
      }
    }

    // Remove redundant columns from vendors table
    const vendorColumns = ['billing_attention', 'billing_country', 'billing_address1', 'billing_address2', 'billing_city', 'billing_state', 'billing_pin_code', 'shipping_attention', 'shipping_country', 'shipping_address1', 'shipping_address2', 'shipping_city', 'shipping_state', 'shipping_pin_code', 'bank_name', 'account_holder_name', 'account_number', 'ifsc_code', 'branch_name', 'account_type', 'swift_code', 'iban'];
    
    for (const column of vendorColumns) {
      try {
        await connection.execute(`ALTER TABLE vendors DROP COLUMN ${column}`);
      } catch (error) {
        console.log(`Column ${column} might not exist in vendors table`);
      }
    }

    // Remove redundant columns from customers table
    for (const column of vendorColumns) {
      try {
        await connection.execute(`ALTER TABLE customers DROP COLUMN ${column}`);
      } catch (error) {
        console.log(`Column ${column} might not exist in customers table`);
      }
    }

    console.log('Database normalization completed successfully!');
  } catch (error) {
    console.error('Error during normalization:', error);
  } finally {
    await connection.end();
  }
}

normalizeDatabase();