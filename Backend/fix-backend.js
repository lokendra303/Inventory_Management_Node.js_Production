const db = require('./src/database/connection');

async function fixBackendIssues() {
  try {
    // Connect to database
    await db.connect();
    console.log('✅ Database connected');
    
    // Test basic queries
    const institutions = await db.query('SELECT COUNT(*) as count FROM institutions');
    console.log(`✅ institutions: ${institutions[0].count}`);
    
    const users = await db.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Users: ${users[0].count}`);
    
    const warehouses = await db.query('SELECT COUNT(*) as count FROM warehouses');
    console.log(`✅ Warehouses: ${warehouses[0].count}`);
    
    console.log('✅ Database queries working');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

fixBackendIssues();