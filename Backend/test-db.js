const mysql = require('mysql2/promise');

async function testDatabase() {
  let connection;
  try {
    console.log('Testing database connection...');
    
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '12345',
      database: 'ims_sepcune'
    });

    console.log('✅ Database connected successfully');

    // Test basic queries
    console.log('\nTesting basic queries...');
    
    // Check if tables exist
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND TABLE_NAME IN ('purchase_orders', 'vendors', 'institutions', 'institution_users')
    `);
    
    console.log('Available tables:', tables.map(t => t.TABLE_NAME));

    // Test purchase_orders table
    try {
      const [pos] = await connection.execute('SELECT COUNT(*) as count FROM purchase_orders');
      console.log('Purchase orders count:', pos[0].count);
    } catch (error) {
      console.error('Error querying purchase_orders:', error.message);
    }

    // Test vendors table
    try {
      const [vendors] = await connection.execute('SELECT COUNT(*) as count FROM vendors');
      console.log('Vendors count:', vendors[0].count);
    } catch (error) {
      console.error('Error querying vendors:', error.message);
    }

    // Test institutions table
    try {
      const [institutions] = await connection.execute('SELECT COUNT(*) as count FROM institutions');
      console.log('Institutions count:', institutions[0].count);
    } catch (error) {
      console.error('Error querying institutions:', error.message);
    }

    // Test institution_users table
    try {
      const [users] = await connection.execute('SELECT COUNT(*) as count FROM institution_users');
      console.log('Institution users count:', users[0].count);
    } catch (error) {
      console.error('Error querying institution_users:', error.message);
    }

    console.log('\n✅ Database tests completed');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDatabase();