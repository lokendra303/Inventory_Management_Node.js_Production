const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

/**
 * Setup Test Data Script
 * 
 * This script creates essential test data for development and testing:
 * - Creates test institution and admin user
 * - Sets up basic database structure if missing
 * - Provides credentials for testing API endpoints
 * 
 * Usage: node setup-test-data.js
 * 
 * IMPORTANT: Only use in development/testing environments
 */

async function setupTestData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Setting up test data...');

    // Check if institutions table exists
    const [institutionTables] = await connection.execute("SHOW TABLES LIKE 'institutions'");
    if (institutionTables.length === 0) {
      console.log('Creating institutions table...');
      await connection.execute(`
        CREATE TABLE institutions (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    }

    // Check if users table exists
    const [userTables] = await connection.execute("SHOW TABLES LIKE 'users'");
    if (userTables.length === 0) {
      console.log('Creating users table...');
      await connection.execute(`
        CREATE TABLE users (
          id VARCHAR(36) PRIMARY KEY,
          institution_id VARCHAR(36) NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile VARCHAR(20),
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          role VARCHAR(100) DEFAULT 'user',
          permissions JSON,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_institution_email (institution_id, email)
        )
      `);
    }

    // Check if test institution exists
    const [institutions] = await connection.execute("SELECT * FROM institutions WHERE name = 'Test institution'");
    let institutionId;
    
    if (institutions.length === 0) {
      institutionId = uuidv4();
      await connection.execute(
        "INSERT INTO institutions (id, name, status) VALUES (?, ?, 'active')",
        [institutionId, 'Test institution']
      );
      console.log('✅ Test institution created');
    } else {
      institutionId = institutions[0].id;
      console.log('✅ Test institution already exists');
    }

    // Check if test user exists
    const [users] = await connection.execute(
      "SELECT * FROM users WHERE institution_id = ? AND email = 'test@example.com'",
      [institutionId]
    );

    if (users.length === 0) {
      const userId = uuidv4();
      // Using a simple hash for testing - in production use proper bcrypt
      const simpleHash = 'hashed_password123';
      
      await connection.execute(`
        INSERT INTO users (id, institution_id, email, password_hash, first_name, last_name, role, permissions, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, [
        userId,
        institutionId,
        'test@example.com',
        simpleHash,
        'Test',
        'User',
        'admin',
        JSON.stringify({
          vendor_view: true,
          vendor_management: true,
          purchase_order_view: true,
          purchase_order_management: true
        })
      ]);
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user already exists');
    }

    console.log('\n=== TEST CREDENTIALS ===');
    console.log(`institution ID: ${institutionId}`);
    console.log('Email: test@example.com');
    console.log('Password: password123');
    console.log('Role: admin');
    console.log('========================\n');

  } catch (error) {
    console.error('❌ Error setting up test data:', error.message);
  } finally {
    await connection.end();
  }
}

setupTestData();