const migrations = {
  // Create institutions table
  createinstitutionsTable: `
    CREATE TABLE IF NOT EXISTS institutions (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      plan VARCHAR(50) DEFAULT 'starter',
      status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
      settings JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_institution_status (status),
      INDEX idx_institution_name (name)
    )
  `,

  // Create users table
  createUsersTable: `
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
      INDEX idx_user_status (status),
      INDEX idx_user_role (role)
    )
  `,

  // Create temp access tokens table
  createTempAccessTokensTable: `
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
      INDEX idx_temp_token_active (is_active),
      INDEX idx_temp_token_expires (expires_at)
    )
  `,

  // Run all migrations
  async runMigrations(database) {
    try {
      console.log('Running Universal Auth migrations...');
      
      await database.query(this.createinstitutionsTable);
      console.log('✓ institutions table created');
      
      await database.query(this.createUsersTable);
      console.log('✓ Users table created');
      
      await database.query(this.createTempAccessTokensTable);
      console.log('✓ Temp access tokens table created');
      
      console.log('✓ All Universal Auth migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
};

module.exports = migrations;