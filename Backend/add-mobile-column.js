const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function addMobileColumn() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    
    await connection.execute('ALTER TABLE users ADD COLUMN mobile VARCHAR(20) AFTER last_name');
    
    console.log('✅ Mobile column added to users table');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

addMobileColumn();