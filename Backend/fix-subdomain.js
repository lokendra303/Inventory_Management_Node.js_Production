const mysql = require('mysql2/promise');

async function removeSubdomain() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    // Check if subdomain column exists
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'institutions' AND COLUMN_NAME = 'subdomain'"
    );

    if (columns.length > 0) {
      // Remove subdomain column
      await connection.execute('ALTER TABLE institutions DROP COLUMN subdomain');
      console.log('Subdomain column removed successfully');
    } else {
      console.log('Subdomain column does not exist');
    }

    // Show current table structure
    const [structure] = await connection.execute('DESCRIBE institutions');
    console.log('Current institutions table structure:');
    console.table(structure);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

removeSubdomain();