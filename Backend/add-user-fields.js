const mysql = require('mysql2/promise');

async function addUserFields() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Add additional user fields
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN address TEXT AFTER last_name,
      ADD COLUMN city VARCHAR(100) AFTER address,
      ADD COLUMN state VARCHAR(100) AFTER city,
      ADD COLUMN country VARCHAR(100) AFTER state,
      ADD COLUMN postal_code VARCHAR(20) AFTER country,
      ADD COLUMN date_of_birth DATE AFTER postal_code,
      ADD COLUMN gender ENUM('male', 'female', 'other') AFTER date_of_birth,
      ADD COLUMN department VARCHAR(100) AFTER gender,
      ADD COLUMN designation VARCHAR(100) AFTER department,
      ADD COLUMN profile_image VARCHAR(255) AFTER designation
    `);
    console.log('Additional user fields added successfully');

    // Show updated table structure
    const [structure] = await connection.execute('DESCRIBE users');
    console.log('Updated users table structure:');
    console.table(structure);

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Some fields already exist');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await connection.end();
  }
}

addUserFields();