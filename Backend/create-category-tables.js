const mysql = require('mysql2/promise');

async function createCategoryTables() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id VARCHAR(36) DEFAULT NULL,
        level INT DEFAULT 0,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
        UNIQUE KEY unique_category_name (institution_id, name, parent_id),
        INDEX idx_institution_active (institution_id, is_active),
        INDEX idx_parent (parent_id)
      )
    `);

    console.log('Category management table created successfully');
  } catch (error) {
    console.error('Error creating tables:', error.message);
  } finally {
    await connection.end();
  }
}

createCategoryTables();