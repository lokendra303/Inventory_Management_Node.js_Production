const mysql = require('mysql2/promise');

async function createInstitutionBasedDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Creating institution-based database schema...');

    // 1. Institutions table (replaces institutions)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS institutions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        institution_type ENUM('educational', 'corporate', 'government', 'healthcare', 'other') DEFAULT 'corporate',
        registration_number VARCHAR(100),
        tax_id VARCHAR(100),
        website VARCHAR(255),
        contact_person VARCHAR(255),
        status ENUM('active', 'inactive', 'pending') DEFAULT 'active',
        plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'starter',
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_institution_type (institution_type)
      )
    `);

    // 2. Institution Users table (replaces users)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS institution_users (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        date_of_birth DATE,
        gender ENUM('male', 'female', 'other'),
        department VARCHAR(100),
        designation VARCHAR(100),
        employee_id VARCHAR(50),
        role VARCHAR(100) DEFAULT 'user',
        permissions JSON,
        warehouse_access JSON,
        status ENUM('active', 'inactive') DEFAULT 'active',
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_institution_email (institution_id, email),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_status (institution_id, status),
        INDEX idx_role (role),
        INDEX idx_department (department)
      )
    `);

    // 3. Categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id VARCHAR(36),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_institution_name (institution_id, name),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_parent (institution_id, parent_id)
      )
    `);

    // 4. Warehouses table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type_id VARCHAR(36),
        address TEXT,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        capacity_constraints JSON,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_institution_code (institution_id, code),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_type (institution_id, type_id)
      )
    `);

    // 5. Items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS items (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        sku VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type ENUM('simple', 'variant', 'composite', 'service') DEFAULT 'simple',
        category VARCHAR(255),
        unit VARCHAR(50) DEFAULT 'pcs',
        barcode VARCHAR(255),
        hsn_code VARCHAR(50),
        custom_fields JSON,
        valuation_method ENUM('fifo', 'weighted_average') DEFAULT 'fifo',
        allow_negative_stock BOOLEAN DEFAULT FALSE,
        cost_price DECIMAL(15,4),
        selling_price DECIMAL(15,4),
        mrp DECIMAL(15,4),
        tax_rate DECIMAL(5,2),
        brand VARCHAR(100),
        manufacturer VARCHAR(100),
        min_stock_level DECIMAL(15,3),
        max_stock_level DECIMAL(15,3),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_institution_sku (institution_id, sku),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_category (institution_id, category),
        INDEX idx_institution_status (institution_id, status)
      )
    `);

    // 6. Vendors table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        vendor_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        payment_terms VARCHAR(100),
        lead_time_days INT DEFAULT 7,
        currency VARCHAR(3) DEFAULT 'USD',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_institution_code (institution_id, vendor_code),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_status (institution_id, status)
      )
    `);

    // 7. Customers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        customer_code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        payment_terms VARCHAR(100),
        credit_limit DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'USD',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_institution_code (institution_id, customer_code),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_status (institution_id, status)
      )
    `);

    // 8. Inventory Projections table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_projections (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        quantity_on_hand DECIMAL(15,3) DEFAULT 0,
        quantity_available DECIMAL(15,3) DEFAULT 0,
        quantity_reserved DECIMAL(15,3) DEFAULT 0,
        average_cost DECIMAL(15,4) DEFAULT 0,
        total_value DECIMAL(15,2) DEFAULT 0,
        last_movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        version INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_institution_item_warehouse (institution_id, item_id, warehouse_id),
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_institution_warehouse (institution_id, warehouse_id),
        INDEX idx_institution_item (institution_id, item_id)
      )
    `);

    console.log('✅ All tables created with institution-based structure!');

  } catch (error) {
    console.error('❌ Error creating database schema:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createInstitutionBasedDatabase();