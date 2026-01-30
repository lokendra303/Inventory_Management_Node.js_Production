const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

// List of all tables to drop (in reverse dependency order)
const tablesToDrop = [
  'grn_lines',
  'goods_receipt_notes',
  'item_serials',
  'item_batches',
  'low_stock_alerts',
  'reorder_levels',
  'warehouse_bins',
  'warehouse_racks',
  'warehouse_zones',
  'composite_components',
  'sales_order_lines',
  'sales_orders',
  'purchase_order_lines',
  'purchase_orders',
  'inventory_projections',
  'items',
  'categories',
  'warehouses',
  'warehouse_types',
  'vendors',
  'workflow_instances',
  'workflow_definitions',
  'automation_rules',
  'bearer_tokens',
  'api_keys',
  'roles',
  'event_store',
  'users',
  'institutions'
];

// All table creation queries
const tableCreationQueries = [
  // institutions table
  `CREATE TABLE institutions (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'starter',
    status ENUM('active', 'suspended', 'cancelled') DEFAULT 'active',
    settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subdomain (subdomain),
    INDEX idx_status (status)
  )`,

  // Users table
  `CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(100) DEFAULT 'user',
    permissions JSON,
    warehouse_access JSON,
    status ENUM('active', 'inactive') DEFAULT 'active',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_email (institution_id, email),
    INDEX idx_institution_email (institution_id, email),
    INDEX idx_institution_status (institution_id, status)
  )`,

  // Event Store
  `CREATE TABLE event_store (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_version INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON NOT NULL,
    metadata JSON,
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_idempotency (institution_id, idempotency_key),
    UNIQUE KEY unique_aggregate_version (institution_id, aggregate_type, aggregate_id, aggregate_version),
    INDEX idx_institution_aggregate (institution_id, aggregate_type, aggregate_id),
    INDEX idx_institution_event_type (institution_id, event_type),
    INDEX idx_created_at (created_at)
  )`,

  // Roles table
  `CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSON NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_role (institution_id, name),
    INDEX idx_institution (institution_id)
  )`,

  // API Keys table
  `CREATE TABLE api_keys (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    key_value VARCHAR(255) UNIQUE NOT NULL,
    permissions JSON,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    INDEX idx_institution_id (institution_id),
    INDEX idx_key_value (key_value),
    INDEX idx_status (status),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
  )`,

  // Bearer Tokens table
  `CREATE TABLE bearer_tokens (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    token_value VARCHAR(255) UNIQUE NOT NULL,
    permissions JSON,
    status ENUM('active', 'inactive') DEFAULT 'active',
    expires_at TIMESTAMP NULL,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    INDEX idx_institution_id (institution_id),
    INDEX idx_token_value (token_value),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
  )`,

  // Automation Rules
  `CREATE TABLE automation_rules (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_event VARCHAR(100) NOT NULL,
    conditions JSON NOT NULL,
    actions JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_institution_trigger (institution_id, trigger_event),
    INDEX idx_institution_active (institution_id, is_active)
  )`,

  // Workflow Definitions
  `CREATE TABLE workflow_definitions (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    steps JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_institution_entity (institution_id, entity_type)
  )`,

  // Workflow Instances
  `CREATE TABLE workflow_instances (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    workflow_definition_id VARCHAR(36) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    current_step INT DEFAULT 0,
    status ENUM('pending', 'approved', 'rejected', 'escalated') DEFAULT 'pending',
    data JSON,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_institution_status (institution_id, status),
    INDEX idx_entity (entity_type, entity_id)
  )`,

  // Vendors table
  `CREATE TABLE vendors (
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
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_vendor_code (institution_id, vendor_code),
    INDEX idx_institution_status (institution_id, status)
  )`,

  // Warehouse Types table
  `CREATE TABLE warehouse_types (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_type (institution_id, name),
    INDEX idx_institution (institution_id)
  )`,

  // Warehouses
  `CREATE TABLE warehouses (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    capacity_constraints JSON,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_code (institution_id, code),
    INDEX idx_institution_status (institution_id, status)
  )`,

  // Categories table
  `CREATE TABLE categories (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id VARCHAR(36) DEFAULT NULL,
    level INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    UNIQUE KEY unique_category_name (institution_id, name, parent_id),
    INDEX idx_institution_active (institution_id, is_active),
    INDEX idx_parent (parent_id)
  )`,

  // Items/Products
  `CREATE TABLE items (
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
    default_reorder_level DECIMAL(15,3) DEFAULT 0,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_sku (institution_id, sku),
    INDEX idx_institution_type (institution_id, type),
    INDEX idx_institution_status (institution_id, status),
    INDEX idx_barcode (barcode)
  )`,

  // Inventory Projections
  `CREATE TABLE inventory_projections (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    quantity_on_hand DECIMAL(15,4) DEFAULT 0,
    quantity_reserved DECIMAL(15,4) DEFAULT 0,
    quantity_available DECIMAL(15,4) DEFAULT 0,
    average_cost DECIMAL(15,4) DEFAULT 0,
    total_value DECIMAL(15,2) DEFAULT 0,
    last_movement_date TIMESTAMP NULL,
    version INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_institution_item_warehouse (institution_id, item_id, warehouse_id),
    INDEX idx_institution_warehouse (institution_id, warehouse_id),
    INDEX idx_institution_item (institution_id, item_id)
  )`,

  // Purchase Orders
  `CREATE TABLE purchase_orders (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    po_number VARCHAR(100) NOT NULL,
    vendor_id VARCHAR(36),
    vendor_name VARCHAR(255) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    status ENUM('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'cancelled') DEFAULT 'draft',
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    expected_date DATE,
    order_date DATE DEFAULT (CURRENT_DATE),
    notes TEXT,
    created_by VARCHAR(36) NOT NULL,
    approved_by VARCHAR(36),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY unique_institution_po_number (institution_id, po_number),
    INDEX idx_institution_status (institution_id, status),
    INDEX idx_institution_vendor (institution_id, vendor_id)
  )`,

  // Purchase Order Lines
  `CREATE TABLE purchase_order_lines (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    po_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    quantity_ordered DECIMAL(15,4) NOT NULL,
    quantity_received DECIMAL(15,4) DEFAULT 0,
    unit_cost DECIMAL(15,4) NOT NULL,
    line_total DECIMAL(15,2) NOT NULL,
    expected_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id),
    INDEX idx_po (po_id),
    INDEX idx_institution_item (institution_id, item_id)
  )`,

  // Sales Orders
  `CREATE TABLE sales_orders (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    so_number VARCHAR(100) NOT NULL,
    customer_id VARCHAR(36),
    customer_name VARCHAR(255) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    channel VARCHAR(100) DEFAULT 'direct',
    status ENUM('draft', 'confirmed', 'partially_shipped', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
    currency VARCHAR(3) DEFAULT 'USD',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    expected_ship_date DATE,
    is_preorder BOOLEAN DEFAULT FALSE,
    committed_demand DECIMAL(15,3) DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY unique_institution_so_number (institution_id, so_number),
    INDEX idx_institution_status (institution_id, status),
    INDEX idx_institution_customer (institution_id, customer_id)
  )`,

  // Sales Order Lines
  `CREATE TABLE sales_order_lines (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    so_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    quantity_ordered DECIMAL(15,4) NOT NULL,
    quantity_reserved DECIMAL(15,4) DEFAULT 0,
    quantity_shipped DECIMAL(15,4) DEFAULT 0,
    unit_price DECIMAL(15,4) NOT NULL,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id),
    INDEX idx_so (so_id),
    INDEX idx_institution_item (institution_id, item_id)
  )`,

  // Composite Item Components
  `CREATE TABLE composite_components (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    composite_item_id VARCHAR(36) NOT NULL,
    component_item_id VARCHAR(36) NOT NULL,
    quantity_required DECIMAL(15,4) NOT NULL,
    consumption_timing ENUM('order_confirmation', 'shipment') DEFAULT 'shipment',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (composite_item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE CASCADE,
    INDEX idx_composite (institution_id, composite_item_id),
    INDEX idx_institution_component (institution_id, component_item_id)
  )`,

  // Warehouse Zones
  `CREATE TABLE warehouse_zones (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    zone_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity_limit INT DEFAULT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_zone_code (institution_id, warehouse_id, zone_code),
    INDEX idx_institution_warehouse (institution_id, warehouse_id)
  )`,

  // Warehouse Racks
  `CREATE TABLE warehouse_racks (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    zone_id VARCHAR(36) NOT NULL,
    rack_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity_limit INT DEFAULT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rack_code (institution_id, zone_id, rack_code),
    INDEX idx_institution_zone (institution_id, zone_id)
  )`,

  // Warehouse Bins
  `CREATE TABLE warehouse_bins (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    rack_id VARCHAR(36) NOT NULL,
    bin_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    capacity_limit INT DEFAULT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rack_id) REFERENCES warehouse_racks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bin_code (institution_id, rack_id, bin_code),
    INDEX idx_institution_rack (institution_id, rack_id)
  )`,

  // Reorder Levels
  `CREATE TABLE reorder_levels (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    reorder_level DECIMAL(15,3) NOT NULL DEFAULT 0,
    reorder_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    max_stock_level DECIMAL(15,3) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_item_warehouse (institution_id, item_id, warehouse_id),
    INDEX idx_institution_active (institution_id, is_active)
  )`,

  // Low Stock Alerts
  `CREATE TABLE low_stock_alerts (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    current_stock DECIMAL(15,3) NOT NULL,
    reorder_level DECIMAL(15,3) NOT NULL,
    alert_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'acknowledged', 'resolved') DEFAULT 'active',
    acknowledged_by VARCHAR(36) DEFAULT NULL,
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    INDEX idx_institution_status (institution_id, status),
    INDEX idx_alert_date (alert_date)
  )`,

  // Item Batches
  `CREATE TABLE item_batches (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    manufacture_date DATE DEFAULT NULL,
    expiry_date DATE DEFAULT NULL,
    quantity_received DECIMAL(15,3) NOT NULL,
    quantity_remaining DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,
    status ENUM('active', 'expired', 'damaged', 'recalled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_batch (institution_id, item_id, warehouse_id, batch_number),
    INDEX idx_expiry (institution_id, expiry_date, status)
  )`,

  // Item Serials
  `CREATE TABLE item_serials (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    batch_id VARCHAR(36) DEFAULT NULL,
    status ENUM('available', 'reserved', 'sold', 'damaged', 'returned') DEFAULT 'available',
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sold_date TIMESTAMP NULL,
    customer_reference VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES item_batches(id) ON DELETE SET NULL,
    UNIQUE KEY unique_serial (institution_id, item_id, serial_number),
    INDEX idx_status (institution_id, status)
  )`,

  // Goods Receipt Notes
  `CREATE TABLE goods_receipt_notes (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    grn_number VARCHAR(100) NOT NULL,
    po_id VARCHAR(36) NOT NULL,
    warehouse_id VARCHAR(36) NOT NULL,
    receipt_date DATE NOT NULL,
    received_by VARCHAR(36) NOT NULL,
    notes TEXT,
    status ENUM('draft', 'confirmed') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (received_by) REFERENCES users(id),
    UNIQUE KEY unique_institution_grn (institution_id, grn_number),
    INDEX idx_institution_po (institution_id, po_id)
  )`,

  // GRN Lines
  `CREATE TABLE grn_lines (
    id VARCHAR(36) PRIMARY KEY,
    institution_id VARCHAR(36) NOT NULL,
    grn_id VARCHAR(36) NOT NULL,
    po_line_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    quantity_received DECIMAL(15,4) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,
    line_total DECIMAL(15,2) NOT NULL,
    quality_status ENUM('accepted', 'rejected', 'pending') DEFAULT 'accepted',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    FOREIGN KEY (po_line_id) REFERENCES purchase_order_lines(id),
    FOREIGN KEY (item_id) REFERENCES items(id),
    INDEX idx_grn (grn_id),
    INDEX idx_institution_item (institution_id, item_id)
  )`
];

async function resetAndMigrateDatabase() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Disable foreign key checks
    console.log('🔧 Disabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // Drop all existing tables
    console.log('🗑️  Dropping existing tables...');
    for (const table of tablesToDrop) {
      try {
        await connection.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   ✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`   ⚠️  Could not drop table ${table}: ${error.message}`);
      }
    }
    
    // Re-enable foreign key checks
    console.log('🔧 Re-enabling foreign key checks...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    // Create all tables
    console.log('🏗️  Creating tables...');
    for (let i = 0; i < tableCreationQueries.length; i++) {
      try {
        await connection.execute(tableCreationQueries[i]);
        console.log(`   ✅ Created table ${i + 1}/${tableCreationQueries.length}`);
      } catch (error) {
        console.error(`   ❌ Error creating table ${i + 1}: ${error.message}`);
        throw error;
      }
    }
    
    // Create default institution and admin user
    console.log('👤 Creating default institution and admin user...');
    const institutionId = uuidv4();
    const userId = uuidv4();
    
    await connection.execute(
      `INSERT INTO institutions (id, name, subdomain, plan, status) 
       VALUES (?, 'Default Company', 'default', 'professional', 'active')`,
      [institutionId]
    );
    
    await connection.execute(
      `INSERT INTO users (id, institution_id, email, password_hash, first_name, last_name, role, status) 
       VALUES (?, ?, 'admin@company.com', '$2b$10$example.hash.here', 'Admin', 'User', 'admin', 'active')`,
      [userId, institutionId]
    );
    
    console.log('✅ Database reset and migration completed successfully!');
    console.log(`📋 Default institution ID: ${institutionId}`);
    console.log(`👤 Default admin user ID: ${userId}`);
    console.log('📧 Default admin email: admin@company.com');
    console.log('🔑 Please update the password hash for the admin user');
    
  } catch (error) {
    console.error('❌ Database reset and migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  resetAndMigrateDatabase()
    .then(() => {
      console.log('🎉 Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetAndMigrateDatabase };