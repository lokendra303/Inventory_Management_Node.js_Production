const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function removeSubdomain() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Remove subdomain column and related index
    console.log('🗑️  Removing subdomain column...');
    await connection.execute('ALTER TABLE institutions DROP INDEX idx_subdomain');
    await connection.execute('ALTER TABLE institutions DROP COLUMN subdomain');
    
    console.log('✅ Subdomain column removed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to remove subdomain:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

if (require.main === module) {
  removeSubdomain()
    .then(() => {
      console.log('🎉 Subdomain removal completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Subdomain removal failed:', error);
      process.exit(1);
    });
}

module.exports = { removeSubdomain };