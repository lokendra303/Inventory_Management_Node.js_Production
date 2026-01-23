const db = require('./connection');

const createTempAccessTable = `
  CREATE TABLE IF NOT EXISTS temp_access_tokens (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    target_user_id VARCHAR(36) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    temp_password VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tenant_user (tenant_id, target_user_id),
    INDEX idx_expires (expires_at),
    INDEX idx_active (is_active)
  )
`;

async function createTempAccessTokensTable() {
  try {
    await db.connect();
    await db.query(createTempAccessTable);
    console.log('Temp access tokens table created successfully');
  } catch (error) {
    console.error('Error creating temp access tokens table:', error);
    throw error;
  }
}

if (require.main === module) {
  createTempAccessTokensTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createTempAccessTokensTable };