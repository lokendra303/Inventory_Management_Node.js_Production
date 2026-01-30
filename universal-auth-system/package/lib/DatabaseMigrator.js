const mysql = require('mysql2/promise');

class DatabaseMigrator {
  constructor(database) {
    this.db = database;
  }

  // Check if table exists
  async tableExists(tableName) {
    const [rows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
      [tableName]
    );
    return rows[0].count > 0;
  }

  // Check if column exists in table
  async columnExists(tableName, columnName) {
    const [rows] = await this.db.execute(
      'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [tableName, columnName]
    );
    return rows[0].count > 0;
  }

  // Add institution_id to existing tables
  async addinstitutionSupport(tableName) {
    console.log(`🔄 Adding multi-institution support to ${tableName}...`);
    
    if (!await this.tableExists(tableName)) {
      console.log(`⚠️ Table ${tableName} doesn't exist - skipping`);
      return;
    }

    // Add institution_id column if missing
    if (!await this.columnExists(tableName, 'institution_id')) {
      await this.db.execute(`
        ALTER TABLE ${tableName} 
        ADD COLUMN institution_id VARCHAR(36) DEFAULT 'default' AFTER id
      `);
      console.log(`✅ Added institution_id to ${tableName}`);
    }

    // Add index for institution_id
    try {
      await this.db.execute(`
        ALTER TABLE ${tableName} 
        ADD INDEX idx_${tableName}_institution (institution_id)
      `);
    } catch (error) {
      // Index might already exist
    }
  }

  // Migrate existing data to default institution
  async migrateExistingData() {
    console.log('🔄 Migrating existing data to default institution...');
    
    // Create default institution if not exists
    const defaultinstitutionId = 'default-institution-' + Date.now();
    
    try {
      await this.db.execute(`
        INSERT IGNORE INTO institutions (id, name, status) 
        VALUES (?, 'Default Company', 'active')
      `, [defaultinstitutionId]);
      
      // Update all tables with null institution_id
      const tables = ['users', 'products', 'orders', 'inventory', 'items', 'warehouses'];
      
      for (const table of tables) {
        if (await this.tableExists(table)) {
          await this.db.execute(`
            UPDATE ${table} 
            SET institution_id = ? 
            WHERE institution_id IS NULL OR institution_id = 'default'
          `, [defaultinstitutionId]);
          console.log(`✅ Migrated ${table} data to default institution`);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Migration warning:', error.message);
    }
  }

  // Auto-detect and migrate existing project
  async autoMigrate() {
    console.log('🚀 Starting auto-migration for existing project...\n');
    
    // 1. Create auth tables
    await this.createAuthTables();
    
    // 2. Detect existing tables and add institution support
    const existingTables = await this.getExistingTables();
    console.log('📋 Found existing tables:', existingTables.join(', '));
    
    for (const table of existingTables) {
      if (!['institutions', 'users', 'temp_access_tokens'].includes(table)) {
        await this.addinstitutionSupport(table);
      }
    }
    
    // 3. Migrate existing data
    await this.migrateExistingData();
    
    console.log('\n🎉 Auto-migration completed!');
    console.log('✅ Your existing project now supports multi-institution authentication');
  }

  async getExistingTables() {
    const [rows] = await this.db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    return rows.map(row => row.table_name || row.TABLE_NAME);
  }

  async createAuthTables() {
    console.log('🔄 Creating auth tables...');
    
    // Create institutions table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS institutions (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) DEFAULT 'starter',
        status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_institution_status (status)
      )
    `);

    // Create users table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
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
        role VARCHAR(50) DEFAULT 'user',
        permissions JSON,
        warehouse_access JSON,
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        INDEX idx_user_institution (institution_id),
        INDEX idx_user_email (email),
        INDEX idx_user_status (status)
      )
    `);

    // Create temp access tokens table
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS temp_access_tokens (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        target_user_id VARCHAR(36) NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        temp_password VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_temp_token_user (target_user_id),
        INDEX idx_temp_token_active (is_active)
      )
    `);

    console.log('✅ Auth tables created');
  }

  // Handle specific missing fields in existing tables
  async addMissingFields() {
    console.log('🔄 Adding missing fields to existing tables...');
    
    const fieldMappings = {
      users: [
        { field: 'mobile', type: 'VARCHAR(20)', after: 'email' },
        { field: 'address', type: 'TEXT', after: 'last_name' },
        { field: 'city', type: 'VARCHAR(100)', after: 'address' },
        { field: 'state', type: 'VARCHAR(100)', after: 'city' },
        { field: 'country', type: 'VARCHAR(100)', after: 'state' },
        { field: 'postal_code', type: 'VARCHAR(20)', after: 'country' },
        { field: 'date_of_birth', type: 'DATE', after: 'postal_code' },
        { field: 'gender', type: 'ENUM("male", "female", "other")', after: 'date_of_birth' },
        { field: 'department', type: 'VARCHAR(100)', after: 'gender' },
        { field: 'designation', type: 'VARCHAR(100)', after: 'department' },
        { field: 'permissions', type: 'JSON', after: 'role' },
        { field: 'warehouse_access', type: 'JSON', after: 'permissions' },
        { field: 'last_login', type: 'TIMESTAMP NULL', after: 'status' }
      ],
      items: [
        { field: 'institution_id', type: 'VARCHAR(36) DEFAULT "default"', after: 'id' },
        { field: 'created_by', type: 'VARCHAR(36)', after: 'updated_at' }
      ],
      inventory: [
        { field: 'institution_id', type: 'VARCHAR(36) DEFAULT "default"', after: 'id' },
        { field: 'created_by', type: 'VARCHAR(36)', after: 'updated_at' }
      ]
    };

    for (const [tableName, fields] of Object.entries(fieldMappings)) {
      if (await this.tableExists(tableName)) {
        for (const { field, type, after } of fields) {
          if (!await this.columnExists(tableName, field)) {
            try {
              await this.db.execute(`
                ALTER TABLE ${tableName} 
                ADD COLUMN ${field} ${type} ${after ? `AFTER ${after}` : ''}
              `);
              console.log(`✅ Added ${field} to ${tableName}`);
            } catch (error) {
              console.log(`⚠️ Could not add ${field} to ${tableName}:`, error.message);
            }
          }
        }
      }
    }
  }
}

module.exports = DatabaseMigrator;