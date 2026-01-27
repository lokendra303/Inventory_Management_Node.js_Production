const mysql = require('mysql2/promise');

async function createCompleteDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Creating complete database schema...');

    // 1. Tenants table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 2. Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile VARCHAR(20),
        password VARCHAR(255) NOT NULL,
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
        role VARCHAR(100) DEFAULT 'user',
        permissions JSON,
        warehouse_access JSON,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tenant_email (tenant_id, email),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    // 3. Categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id VARCHAR(36),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tenant_name (tenant_id, name),
        INDEX idx_tenant_parent (tenant_id, parent_id)
      )
    `);

    // 4. Warehouse Types table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS warehouse_types (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tenant_name (tenant_id, name)
      )
    `);

    // 5. Warehouses table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
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
        UNIQUE KEY unique_tenant_code (tenant_id, code),
        INDEX idx_tenant_type (tenant_id, type_id)
      )
    `);

    // 6. Items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS items (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
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
        UNIQUE KEY unique_tenant_sku (tenant_id, sku),
        INDEX idx_tenant_category (tenant_id, category),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    // 7. Vendors table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
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
        UNIQUE KEY unique_tenant_code (tenant_id, vendor_code),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    // 8. Customers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
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
        UNIQUE KEY unique_tenant_code (tenant_id, customer_code),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    // 9. Purchase Orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        po_number VARCHAR(100) NOT NULL,
        vendor_id VARCHAR(36),
        vendor_name VARCHAR(255) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
        status ENUM('draft', 'pending_approval', 'approved', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled') DEFAULT 'draft',
        order_date DATE,
        expected_date DATE,
        notes TEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_po_number (tenant_id, po_number),
        INDEX idx_tenant_status (tenant_id, status),
        INDEX idx_vendor (tenant_id, vendor_id),
        INDEX idx_warehouse (tenant_id, warehouse_id)
      )
    `);

    // 10. Purchase Order Lines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_lines (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        po_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        line_number INT NOT NULL,
        quantity_ordered DECIMAL(15,3) NOT NULL,
        quantity_received DECIMAL(15,3) DEFAULT 0,
        unit_cost DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        status ENUM('pending', 'partially_received', 'received', 'cancelled') DEFAULT 'pending',
        expected_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_po (tenant_id, po_id),
        INDEX idx_item (tenant_id, item_id),
        INDEX idx_status (tenant_id, status)
      )
    `);

    // 11. Sales Orders table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        so_number VARCHAR(100) NOT NULL,
        customer_id VARCHAR(36),
        customer_name VARCHAR(255) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        channel VARCHAR(100) DEFAULT 'direct',
        currency VARCHAR(3) DEFAULT 'USD',
        order_date DATE,
        expected_ship_date DATE,
        notes TEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        committed_demand DECIMAL(15,3) DEFAULT 0,
        is_preorder BOOLEAN DEFAULT FALSE,
        status ENUM('draft', 'confirmed', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_so_number (tenant_id, so_number),
        INDEX idx_tenant_status (tenant_id, status),
        INDEX idx_customer (tenant_id, customer_id),
        INDEX idx_warehouse (tenant_id, warehouse_id)
      )
    `);

    // 12. Sales Order Lines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sales_order_lines (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        so_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        line_number INT NOT NULL,
        quantity_ordered DECIMAL(15,3) NOT NULL,
        quantity_shipped DECIMAL(15,3) DEFAULT 0,
        unit_price DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        status ENUM('pending', 'reserved', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_so (tenant_id, so_id),
        INDEX idx_item (tenant_id, item_id),
        INDEX idx_status (tenant_id, status)
      )
    `);

    // 13. Goods Receipt Notes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS goods_receipt_notes (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        grn_number VARCHAR(100) NOT NULL,
        po_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        receipt_date DATE NOT NULL,
        received_by VARCHAR(36) NOT NULL,
        status ENUM('draft', 'confirmed', 'cancelled') DEFAULT 'confirmed',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_grn_number (tenant_id, grn_number),
        INDEX idx_tenant_po (tenant_id, po_id),
        INDEX idx_receipt_date (tenant_id, receipt_date)
      )
    `);

    // 14. GRN Lines table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS grn_lines (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        grn_id VARCHAR(36) NOT NULL,
        po_line_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        quantity_received DECIMAL(15,3) NOT NULL,
        unit_cost DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        quality_status ENUM('accepted', 'rejected', 'pending') DEFAULT 'accepted',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_grn (tenant_id, grn_id),
        INDEX idx_po_line (tenant_id, po_line_id),
        INDEX idx_item (tenant_id, item_id)
      )
    `);

    // 15. Inventory Projections table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_projections (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
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
        UNIQUE KEY unique_tenant_item_warehouse (tenant_id, item_id, warehouse_id),
        INDEX idx_tenant_warehouse (tenant_id, warehouse_id),
        INDEX idx_tenant_item (tenant_id, item_id)
      )
    `);

    // 16. Event Store table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS event_store (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        aggregate_type VARCHAR(100) NOT NULL,
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_version INT NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSON NOT NULL,
        metadata JSON,
        idempotency_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_aggregate_version (tenant_id, aggregate_type, aggregate_id, aggregate_version),
        UNIQUE KEY unique_idempotency (tenant_id, idempotency_key),
        INDEX idx_tenant_aggregate (tenant_id, aggregate_type, aggregate_id),
        INDEX idx_tenant_event_type (tenant_id, event_type),
        INDEX idx_created_at (created_at)
      )
    `);

    // 17. Reorder Levels table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS reorder_levels (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        min_level DECIMAL(15,3) NOT NULL,
        max_level DECIMAL(15,3) NOT NULL,
        reorder_quantity DECIMAL(15,3) NOT NULL,
        lead_time_days INT DEFAULT 7,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_tenant_item_warehouse (tenant_id, item_id, warehouse_id),
        INDEX idx_tenant_warehouse (tenant_id, warehouse_id)
      )
    `);

    // 18. API Keys table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        permissions JSON,
        status ENUM('active', 'inactive') DEFAULT 'active',
        expires_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_api_key (api_key),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    // 19. Bearer Tokens table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bearer_tokens (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        permissions JSON,
        status ENUM('active', 'inactive') DEFAULT 'active',
        expires_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_token (token),
        INDEX idx_tenant_status (tenant_id, status)
      )
    `);

    console.log('✅ All tables created successfully!');
    console.log('Database schema is ready for the Inventory Management System.');

  } catch (error) {
    console.error('❌ Error creating database schema:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createCompleteDatabase();