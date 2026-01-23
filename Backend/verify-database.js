const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function verifyTables() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database to verify tables...');
    connection = await mysql.createConnection(dbConfig);
    
    // Get all tables
    const [tables] = await connection.execute('SHOW TABLES');
    
    console.log(`\n📊 Found ${tables.length} tables in database 'ims_sepcune':\n`);
    
    for (let i = 0; i < tables.length; i++) {
      const tableName = tables[i][`Tables_in_${dbConfig.database}`];
      
      // Get table structure
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      
      console.log(`${i + 1}. 📋 ${tableName.toUpperCase()}`);
      console.log(`   Columns: ${columns.length}`);
      
      // Show key columns
      const keyColumns = columns.filter(col => 
        col.Field === 'id' || 
        col.Field === 'tenant_id' || 
        col.Field.includes('_id') ||
        col.Key === 'PRI' ||
        col.Key === 'UNI'
      );
      
      if (keyColumns.length > 0) {
        console.log(`   Key fields: ${keyColumns.map(col => col.Field).join(', ')}`);
      }
      
      // Get row count
      const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`   Records: ${countResult[0].count}`);
      console.log('');
    }
    
    // Show foreign key relationships
    console.log('🔗 Foreign Key Relationships:');
    const [fkInfo] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE REFERENCED_TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, COLUMN_NAME
    `, [dbConfig.database]);
    
    const fkByTable = {};
    fkInfo.forEach(fk => {
      if (!fkByTable[fk.TABLE_NAME]) {
        fkByTable[fk.TABLE_NAME] = [];
      }
      fkByTable[fk.TABLE_NAME].push(`${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
    });
    
    Object.keys(fkByTable).forEach(table => {
      console.log(`\n   ${table}:`);
      fkByTable[table].forEach(fk => {
        console.log(`     ${fk}`);
      });
    });
    
    console.log('\n✅ Database verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the verification
if (require.main === module) {
  verifyTables()
    .then(() => {
      console.log('🎉 Verification script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyTables };