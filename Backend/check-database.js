const mysql = require('mysql2/promise');

async function checkDatabaseStructure() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Checking database structure...');

    // Show all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\nTables in database:');
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

    // Check users table structure if it exists
    const [userTables] = await connection.execute("SHOW TABLES LIKE 'users'");
    if (userTables.length > 0) {
      console.log('\nUsers table structure:');
      const [columns] = await connection.execute("DESCRIBE users");
      columns.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });
    } else {
      console.log('\n❌ Users table does not exist');
    }

    // Check institutions table structure if it exists
    const [institutionTables] = await connection.execute("SHOW TABLES LIKE 'institutions'");
    if (institutionTables.length > 0) {
      console.log('\ninstitutions table structure:');
      const [columns] = await connection.execute("DESCRIBE institutions");
      columns.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });
    } else {
      console.log('\n❌ institutions table does not exist');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await connection.end();
  }
}

checkDatabaseStructure();