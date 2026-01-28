const mysql = require('mysql2/promise');

async function checkFieldConfigs() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Checking field configurations...');

    const configs = await connection.execute(`
      SELECT field_name, field_type, item_type, options 
      FROM item_field_configs 
      WHERE field_type = 'select' 
      ORDER BY item_type, field_name
    `);

    console.log('Select field configurations found:');
    console.table(configs[0]);

    const allConfigs = await connection.execute(`
      SELECT COUNT(*) as total, field_type 
      FROM item_field_configs 
      GROUP BY field_type
    `);

    console.log('\nField type counts:');
    console.table(allConfigs[0]);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkFieldConfigs();