const db = require('./src/database');

async function createCustomerBankDetailsTable() {
  try {
    console.log('Creating customer_bank_details table...');

    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_bank_details (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        customer_id VARCHAR(36) NOT NULL,
        bank_name VARCHAR(255),
        account_holder_name VARCHAR(255),
        account_number VARCHAR(50),
        ifsc_code VARCHAR(50),
        account_type VARCHAR(50),
        branch_name VARCHAR(255),
        swift_code VARCHAR(50),
        iban VARCHAR(50),
        is_primary TINYINT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        updated_by VARCHAR(36),
        INDEX idx_institution_customer (institution_id, customer_id),
        INDEX idx_customer (customer_id),
        CONSTRAINT fk_customer_bank_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        CONSTRAINT fk_customer_bank_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )
    `);

    console.log('✓ customer_bank_details table created successfully');

    // Add indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_details_status ON customer_bank_details(status)
    `);

    console.log('✓ Indexes created successfully');

    await db.end();
    console.log('✓ Migration completed successfully');
  } catch (error) {
    console.error('Error creating customer_bank_details table:', error);
    process.exit(1);
  }
}

createCustomerBankDetailsTable();
