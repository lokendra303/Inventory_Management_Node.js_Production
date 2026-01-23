const mysql = require('mysql2/promise');

async function cleanDuplicatesAndAddConstraint() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Find and remove duplicate emails (keep the first one)
    await connection.execute(`
      DELETE u1 FROM users u1
      INNER JOIN users u2 
      WHERE u1.id > u2.id AND u1.email = u2.email
    `);
    console.log('Duplicate emails removed');

    // Add unique constraint on email
    await connection.execute(
      'ALTER TABLE users ADD UNIQUE KEY unique_email (email)'
    );
    console.log('Unique email constraint added successfully');

  } catch (error) {
    if (error.code === 'ER_DUP_KEYNAME') {
      console.log('Unique email constraint already exists');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await connection.end();
  }
}

cleanDuplicatesAndAddConstraint();