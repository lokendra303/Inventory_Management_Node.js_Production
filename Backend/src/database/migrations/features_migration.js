/**
 * Migration: Onboarding, Tax, Exchange Rates, Item Variants, Price Lists, Subscription, Workflows
 * Run: node src/database/migrations/features_migration.js
 */
const db = require('../connection');
const logger = require('../../utils/logger');

async function runMigration() {
  await db.connect();

  const tables = [
    // 1. Onboarding wizard progress per institution
    `CREATE TABLE IF NOT EXISTS onboarding_progress (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL UNIQUE,
      completed_steps JSON NOT NULL DEFAULT ('[]'),
      is_completed TINYINT(1) DEFAULT 0,
      dismissed TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 2. Tax groups
    `CREATE TABLE IF NOT EXISTS tax_groups (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 3. Tax rates
    `CREATE TABLE IF NOT EXISTS tax_rates (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      tax_group_id VARCHAR(36),
      name VARCHAR(100) NOT NULL,
      rate DECIMAL(10,4) NOT NULL,
      tax_type ENUM('GST','VAT','TDS','TCS','IGST','CGST','SGST','custom') DEFAULT 'custom',
      is_compound TINYINT(1) DEFAULT 0,
      is_inclusive TINYINT(1) DEFAULT 0,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
      FOREIGN KEY (tax_group_id) REFERENCES tax_groups(id) ON DELETE SET NULL
    )`,

    // 4. Exchange rates
    `CREATE TABLE IF NOT EXISTS exchange_rates (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      from_currency VARCHAR(10) NOT NULL,
      to_currency VARCHAR(10) NOT NULL,
      rate DECIMAL(20,8) NOT NULL,
      source ENUM('manual','auto') DEFAULT 'manual',
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_institution_pair (institution_id, from_currency, to_currency),
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 5. Item variant attributes (e.g. Size, Color)
    `CREATE TABLE IF NOT EXISTS item_variant_attributes (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      parent_item_id VARCHAR(36) NOT NULL,
      attribute_name VARCHAR(100) NOT NULL,
      attribute_values JSON NOT NULL DEFAULT ('[]'),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 6. Item variants (child items)
    `CREATE TABLE IF NOT EXISTS item_variants (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      parent_item_id VARCHAR(36) NOT NULL,
      sku VARCHAR(100),
      name VARCHAR(255),
      attribute_combination JSON NOT NULL DEFAULT ('{}'),
      selling_price DECIMAL(15,4),
      cost_price DECIMAL(15,4),
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 7. Price lists
    `CREATE TABLE IF NOT EXISTS price_lists (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(255),
      currency VARCHAR(10) DEFAULT 'USD',
      pricelist_type ENUM('sales','purchase') DEFAULT 'sales',
      discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
      discount_value DECIMAL(10,4) DEFAULT 0,
      is_default TINYINT(1) DEFAULT 0,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 8. Price list line items (per-item overrides)
    `CREATE TABLE IF NOT EXISTS price_list_items (
      id VARCHAR(36) PRIMARY KEY,
      price_list_id VARCHAR(36) NOT NULL,
      item_id VARCHAR(36) NOT NULL,
      custom_price DECIMAL(15,4),
      discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
      discount_value DECIMAL(10,4) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pricelist_item (price_list_id, item_id),
      FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE
    )`,

    // 9. Subscription plans
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price_monthly DECIMAL(10,2) DEFAULT 0,
      price_yearly DECIMAL(10,2) DEFAULT 0,
      max_users INT DEFAULT 5,
      max_warehouses INT DEFAULT 2,
      max_items INT DEFAULT 500,
      features JSON DEFAULT ('[]'),
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 10. Institution subscriptions
    `CREATE TABLE IF NOT EXISTS institution_subscriptions (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL UNIQUE,
      plan_id VARCHAR(36) NOT NULL,
      billing_cycle ENUM('monthly','yearly','trial') DEFAULT 'trial',
      status ENUM('active','expired','cancelled','trial') DEFAULT 'trial',
      trial_ends_at TIMESTAMP,
      current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      current_period_end TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
    )`,

    // 11. Workflow rules
    `CREATE TABLE IF NOT EXISTS workflow_rules (
      id VARCHAR(36) PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(255),
      module ENUM('inventory','sales_order','purchase_order','invoice','item') NOT NULL,
      trigger_event VARCHAR(100) NOT NULL,
      conditions JSON DEFAULT ('[]'),
      actions JSON DEFAULT ('[]'),
      is_active TINYINT(1) DEFAULT 1,
      execution_count INT DEFAULT 0,
      last_executed_at TIMESTAMP NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
    )`,

    // 12. Workflow execution logs
    `CREATE TABLE IF NOT EXISTS workflow_logs (
      id VARCHAR(36) PRIMARY KEY,
      rule_id VARCHAR(36) NOT NULL,
      institution_id VARCHAR(36) NOT NULL,
      trigger_data JSON,
      actions_executed JSON,
      status ENUM('success','failed','partial') DEFAULT 'success',
      error_message TEXT,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE
    )`
  ];

  for (const sql of tables) {
    try {
      await db.query(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      logger.info(`Table ready: ${tableName}`);
    } catch (err) {
      logger.error('Migration error:', err.message);
    }
  }

  // Seed default subscription plans
  const plans = [
    ['starter-plan-id', 'Starter', 'Perfect for small businesses', 0, 0, 3, 1, 100, '["inventory","sales","purchases"]'],
    ['pro-plan-id', 'Professional', 'For growing businesses', 29, 290, 10, 5, 2000, '["inventory","sales","purchases","reports","workflows","price_lists"]'],
    ['enterprise-plan-id', 'Enterprise', 'Unlimited everything', 99, 990, -1, -1, -1, '["all"]'],
  ];

  for (const [id, name, desc, pm, py, mu, mw, mi, features] of plans) {
    await db.query(
      `INSERT IGNORE INTO subscription_plans (id, name, description, price_monthly, price_yearly, max_users, max_warehouses, max_items, features)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, desc, pm, py, mu, mw, mi, features]
    );
  }

  logger.info('Migration completed successfully');
  process.exit(0);
}

runMigration().catch(err => { console.error(err); process.exit(1); });
