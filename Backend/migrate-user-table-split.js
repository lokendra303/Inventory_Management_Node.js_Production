const mysql = require('mysql2/promise');

async function migrateUserTableSplit() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Starting user table split migration...');

    // 1. Create institutions table (replaces institution registration)
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

    // 2. Create institution_users table (replaces users created by institutions)
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

    // 3. Migrate existing data from institutions to institutions
    console.log('Migrating institutions to institutions...');
    const institutions = await connection.execute('SELECT * FROM institutions');
    
    for (const institution of institutions[0]) {
      // Get the admin user for this institution to extract contact info
      const adminUsers = await connection.execute(
        'SELECT * FROM users WHERE institution_id = ? AND role = "admin" LIMIT 1',
        [institution.id]
      );
      
      const adminUser = adminUsers[0][0];
      
      await connection.execute(`
        INSERT INTO institutions (
          id, name, email, mobile, address, city, state, country, postal_code,
          contact_person, status, plan, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        institution.id,
        institution.name,
        adminUser?.email || `admin@${institution.name.toLowerCase().replace(/\s+/g, '')}.com`,
        adminUser?.mobile,
        adminUser?.address,
        adminUser?.city,
        adminUser?.state,
        adminUser?.country,
        adminUser?.postal_code,
        adminUser ? `${adminUser.first_name} ${adminUser.last_name}` : null,
        institution.status,
        institution.plan || 'starter',
        institution.settings || '{}',
        institution.created_at,
        institution.updated_at
      ]);
    }

    // 4. Migrate existing users to institution_users
    console.log('Migrating users to institution_users...');
    const users = await connection.execute('SELECT * FROM users');
    
    for (const user of users[0]) {
      await connection.execute(`
        INSERT INTO institution_users (
          id, institution_id, email, mobile, password_hash, first_name, last_name,
          address, city, state, country, postal_code, date_of_birth, gender,
          department, designation, role, permissions, warehouse_access, status,
          last_login, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user.id,
        user.institution_id, // This becomes institution_id
        user.email,
        user.mobile,
        user.password_hash || user.password, // Handle both column names
        user.first_name,
        user.last_name,
        user.address,
        user.city,
        user.state,
        user.country,
        user.postal_code,
        user.date_of_birth,
        user.gender,
        user.department,
        user.designation,
        user.role,
        typeof user.permissions === 'string' ? user.permissions : JSON.stringify(user.permissions || {}),
        typeof user.warehouse_access === 'string' ? user.warehouse_access : JSON.stringify(user.warehouse_access || []),
        user.status,
        user.last_login,
        user.created_at,
        user.updated_at
      ]);
    }

    // 5. Update all foreign key references from institution_id to institution_id
    console.log('Updating foreign key references...');
    
    const tablesToUpdate = [
      'categories', 'warehouses', 'items', 'vendors', 'customers',
      'purchase_orders', 'purchase_order_lines', 'sales_orders', 'sales_order_lines',
      'goods_receipt_notes', 'grn_lines', 'inventory_projections', 'event_store',
      'reorder_levels', 'api_keys', 'bearer_tokens'
    ];

    for (const table of tablesToUpdate) {
      try {
        // Check if table exists and has institution_id column
        const tableInfo = await connection.execute(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'ims_sepcune' AND TABLE_NAME = ? AND COLUMN_NAME = 'institution_id'
        `, [table]);
        
        if (tableInfo[0].length > 0) {
          // Add institution_id column
          await connection.execute(`
            ALTER TABLE ${table} ADD COLUMN institution_id VARCHAR(36) AFTER institution_id
          `);
          
          // Copy institution_id values to institution_id
          await connection.execute(`
            UPDATE ${table} SET institution_id = institution_id
          `);
          
          // Add foreign key constraint
          await connection.execute(`
            ALTER TABLE ${table} 
            ADD CONSTRAINT fk_${table}_institution 
            FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
          `);
          
          console.log(`✅ Updated ${table} table`);
        }
      } catch (error) {
        console.log(`⚠️  Skipping ${table}: ${error.message}`);
      }
    }

    // 6. Create backup of original tables before dropping
    console.log('Creating backup tables...');
    await connection.execute('CREATE TABLE institutions_backup AS SELECT * FROM institutions');
    await connection.execute('CREATE TABLE users_backup AS SELECT * FROM users');

    console.log('✅ Migration completed successfully!');
    console.log('📋 Summary:');
    console.log('   - Created institutions table');
    console.log('   - Created institution_users table');
    console.log('   - Migrated all institution data to institutions');
    console.log('   - Migrated all user data to institution_users');
    console.log('   - Updated foreign key references');
    console.log('   - Created backup tables (institutions_backup, users_backup)');
    console.log('');
    console.log('⚠️  Next steps:');
    console.log('   1. Test the application thoroughly');
    console.log('   2. Update application code to use new table structure');
    console.log('   3. Once confirmed working, drop old tables:');
    console.log('      - DROP TABLE users;');
    console.log('      - DROP TABLE institutions;');
    console.log('   4. Remove institution_id columns from other tables');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration
if (require.main === module) {
  migrateUserTableSplit()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateUserTableSplit;