const mysql = require('mysql2/promise');

async function addMobileAndUniqueEmail() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Add mobile number column
    await connection.execute(
      'ALTER TABLE users ADD COLUMN mobile VARCHAR(20) AFTER email'
    );
    console.log('Mobile column added successfully');

    // Add unique constraint on email
    await connection.execute(
      'ALTER TABLE users ADD UNIQUE KEY unique_email (email)'
    );
    console.log('Unique email constraint added successfully');

    // Show updated table structure
    const [structure] = await connection.execute('DESCRIBE users');
    console.log('Updated users table structure:');
    console.table(structure);

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Mobile column already exists');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('Unique email constraint already exists');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await connection.end();
  }
}

addMobileAndUniqueEmail();