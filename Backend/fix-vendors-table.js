const mysql = require('mysql2/promise');

async function fixVendorsTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Fixing vendors table structure...');

    // Disable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Drop existing vendors table if it exists
    await connection.execute('DROP TABLE IF EXISTS vendors');

    // Create vendors table with correct structure
    await connection.execute(`
      CREATE TABLE vendors (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        vendor_code VARCHAR(50),
        display_name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        salutation VARCHAR(10),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        work_phone VARCHAR(50),
        mobile_phone VARCHAR(50),
        pan VARCHAR(20),
        gstin VARCHAR(20),
        msme_registered BOOLEAN DEFAULT FALSE,
        currency VARCHAR(3) DEFAULT 'INR',
        payment_terms VARCHAR(100),
        tds VARCHAR(50),
        website_url VARCHAR(255),
        department VARCHAR(100),
        designation VARCHAR(100),
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
        lead_time_days INT DEFAULT 7,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_status (tenant_id, status),
        INDEX idx_tenant_display_name (tenant_id, display_name)
      )
    `);

    console.log('✅ Vendors table structure fixed successfully!');

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

  } catch (error) {
    console.error('❌ Error fixing vendors table:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixVendorsTable();