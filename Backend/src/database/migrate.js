const db = require('./connection');
const logger = require('../utils/logger');

const migrations = [
  // Tenants table
  `CREATE TABLE IF NOT EXISTS tenants (
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
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_email (tenant_id, email),
    INDEX idx_tenant_email (tenant_id, email),
    INDEX idx_tenant_status (tenant_id, status)
  )`,

  // Event Store - Core of the system
  `CREATE TABLE IF NOT EXISTS event_store (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_version INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON NOT NULL,
    metadata JSON,
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_idempotency (tenant_id, idempotency_key),
    UNIQUE KEY unique_aggregate_version (tenant_id, aggregate_type, aggregate_id, aggregate_version),
    INDEX idx_tenant_aggregate (tenant_id, aggregate_type, aggregate_id),
    INDEX idx_tenant_event_type (tenant_id, event_type),
    INDEX idx_created_at (created_at)
  )`,

  // Warehouses
  `CREATE TABLE IF NOT EXISTS warehouses (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_code (tenant_id, code),
    INDEX idx_tenant_status (tenant_id, status)
  )`,

  // Items/Products
  `CREATE TABLE IF NOT EXISTS items (
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
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_sku (tenant_id, sku),
    INDEX idx_tenant_type (tenant_id, type),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_barcode (barcode)
  )`,

  // Composite Item Components
  `CREATE TABLE IF NOT EXISTS composite_components (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    composite_item_id VARCHAR(36) NOT NULL,
    component_item_id VARCHAR(36) NOT NULL,
    quantity_required DECIMAL(15,4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (composite_item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (component_item_id) REFERENCES items(id) ON DELETE CASCADE,
    INDEX idx_composite (tenant_id, composite_item_id)
  )`,

  // Inventory Projections - Read Model
  `CREATE TABLE IF NOT EXISTS inventory_projections (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_item_warehouse (tenant_id, item_id, warehouse_id),
    INDEX idx_tenant_warehouse (tenant_id, warehouse_id),
    INDEX idx_tenant_item (tenant_id, item_id)
  )`,

  // Vendors
  `CREATE TABLE IF NOT EXISTS vendors (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    vendor_code VARCHAR(100),
    display_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    salutation VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    work_phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    pan VARCHAR(50),
    gstin VARCHAR(50),
    msme_registered BOOLEAN DEFAULT FALSE,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_terms VARCHAR(100),
    tds VARCHAR(100),
    website_url VARCHAR(255),
    department VARCHAR(255),
    designation VARCHAR(255),
    billing_attention VARCHAR(255),
    billing_country VARCHAR(100),
    billing_address1 TEXT,
    billing_address2 TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_pin_code VARCHAR(20),
    shipping_attention VARCHAR(255),
    shipping_country VARCHAR(100),
    shipping_address1 TEXT,
    shipping_address2 TEXT,
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_pin_code VARCHAR(20),
    remarks TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_vendor_code (tenant_id, vendor_code),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_tenant_email (tenant_id, email)
  )`,

  // Vendor Bank Details
  `CREATE TABLE IF NOT EXISTS vendor_bank_details (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    vendor_id VARCHAR(36) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20),
    account_type VARCHAR(50),
    branch_name VARCHAR(255),
    swift_code VARCHAR(20),
    iban VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    INDEX idx_tenant_vendor (tenant_id, vendor_id),
    INDEX idx_vendor_primary (vendor_id, is_primary)
  )`,

  // Customers table
  `CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    customer_code VARCHAR(100),
    display_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    salutation VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    pan VARCHAR(50),
    gstin VARCHAR(50),
    website_url VARCHAR(255),
    billing_attention VARCHAR(255),
    billing_country VARCHAR(100),
    billing_address1 TEXT,
    billing_address2 TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_pin_code VARCHAR(20),
    shipping_attention VARCHAR(255),
    shipping_country VARCHAR(100),
    shipping_address1 TEXT,
    shipping_address2 TEXT,
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_pin_code VARCHAR(20),
    credit_limit DECIMAL(15,2),
    credit_days INT DEFAULT 0,
    price_list VARCHAR(100),
    remarks TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_customer_code (tenant_id, customer_code),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_tenant_email (tenant_id, email)
  )`,

  // Customer Bank Details
  `CREATE TABLE IF NOT EXISTS customer_bank_details (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20),
    account_type VARCHAR(50),
    branch_name VARCHAR(255),
    swift_code VARCHAR(20),
    iban VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_tenant_customer (tenant_id, customer_id),
    INDEX idx_customer_primary (customer_id, is_primary)
  )`,

  // Purchase Orders
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
    notes TEXT,
    created_by VARCHAR(36) NOT NULL,
    approved_by VARCHAR(36),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY unique_tenant_po_number (tenant_id, po_number),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_tenant_vendor (tenant_id, vendor_id)
  )`,

  // Purchase Order Lines
  `CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    po_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    quantity_ordered DECIMAL(15,4) NOT NULL,
    quantity_received DECIMAL(15,4) DEFAULT 0,
    unit_cost DECIMAL(15,4) NOT NULL,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id),
    INDEX idx_po (po_id),
    INDEX idx_tenant_item (tenant_id, item_id)
  )`,

  // Sales Orders
  `CREATE TABLE IF NOT EXISTS sales_orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
    notes TEXT,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE KEY unique_tenant_so_number (tenant_id, so_number),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_tenant_customer (tenant_id, customer_id)
  )`,

  // Sales Order Lines
  `CREATE TABLE IF NOT EXISTS sales_order_lines (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    so_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    quantity_ordered DECIMAL(15,4) NOT NULL,
    quantity_reserved DECIMAL(15,4) DEFAULT 0,
    quantity_shipped DECIMAL(15,4) DEFAULT 0,
    unit_price DECIMAL(15,4) NOT NULL,
    line_total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id),
    INDEX idx_so (so_id),
    INDEX idx_tenant_item (tenant_id, item_id)
  )`,

  // Automation Rules
  `CREATE TABLE IF NOT EXISTS automation_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
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
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_tenant_trigger (tenant_id, trigger_event),
    INDEX idx_tenant_active (tenant_id, is_active)
  )`,

  // Workflow Definitions
  `CREATE TABLE IF NOT EXISTS workflow_definitions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    steps JSON NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_tenant_entity (tenant_id, entity_type)
  )`,

  // Workflow Instances
  `CREATE TABLE IF NOT EXISTS workflow_instances (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    workflow_definition_id VARCHAR(36) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    current_step INT DEFAULT 0,
    status ENUM('pending', 'approved', 'rejected', 'escalated') DEFAULT 'pending',
    data JSON,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_entity (entity_type, entity_id)
  )`,

  // Roles table
  `CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSON NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tenant_role (tenant_id, name),
    INDEX idx_tenant (tenant_id)
  )`
];

async function runMigrations() {
  try {
    await db.connect();
    
    logger.info('Starting database migrations...');
    
    for (let i = 0; i < migrations.length; i++) {
      logger.info(`Running migration ${i + 1}/${migrations.length}`);
      await db.query(migrations[i]);
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };