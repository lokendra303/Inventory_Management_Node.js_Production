const db = require('./src/database/connection');

async function createApiKeysTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
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
      )
    `);
    
    console.log('API keys table created successfully');
  } catch (error) {
    console.error('Error creating API keys table:', error);
  }
}

createApiKeysTable();