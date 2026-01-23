const db = require('./src/database/connection');

async function createBearerTokensTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS bearer_tokens (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
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
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_token_value (token_value),
        INDEX idx_status (status),
        INDEX idx_expires_at (expires_at),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);
    
    console.log('Bearer tokens table created successfully');
  } catch (error) {
    console.error('Error creating Bearer tokens table:', error);
  }
}

createBearerTokensTable();