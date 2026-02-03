const mysql = require('mysql2/promise');

async function cleanupinstitutionReferences() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('🧹 Cleaning up institution references in database...\n');

    // Get all tables that have institution_id column
    const [tables] = await connection.execute(`
      SELECT DISTINCT TABLE_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND COLUMN_NAME = 'institution_id'
    `);

    console.log('Tables with institution_id column:');
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME}`);
    });

    // For each table, drop the institution_id column (since we now have institution_id)
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      try {
        // Check if institution_id column exists
        const [institutionIdExists] = await connection.execute(`
          SELECT COUNT(*) as count 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'ims_sepcune' 
          AND TABLE_NAME = ? 
          AND COLUMN_NAME = 'institution_id'
        `, [tableName]);

        if (institutionIdExists[0].count > 0) {
          // Drop institution_id column since we have institution_id
          await connection.execute(`ALTER TABLE ${tableName} DROP COLUMN institution_id`);
          console.log(`✅ Removed institution_id from ${tableName}`);
        } else {
          // Rename institution_id to institution_id if institution_id doesn't exist
          await connection.execute(`ALTER TABLE ${tableName} CHANGE institution_id institution_id VARCHAR(36) NOT NULL`);
          console.log(`✅ Renamed institution_id to institution_id in ${tableName}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not update ${tableName}: ${error.message}`);
      }
    }

    // Drop the old tables if they still exist
    try {
      await connection.execute('DROP TABLE IF EXISTS institutions');
      console.log('✅ Dropped old institutions table');
    } catch (error) {
      console.log('⚠️  Could not drop institutions table:', error.message);
    }

    try {
      await connection.execute('DROP TABLE IF EXISTS users');
      console.log('✅ Dropped old users table');
    } catch (error) {
      console.log('⚠️  Could not drop users table:', error.message);
    }

    // Verify the cleanup
    console.log('\n🔍 Verifying cleanup...');
    
    const [remaininginstitutionCols] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND COLUMN_NAME LIKE '%institution%'
    `);

    if (remaininginstitutionCols.length === 0) {
      console.log('✅ No institution references found in database');
    } else {
      console.log('⚠️  Remaining institution references:');
      remaininginstitutionCols.forEach(col => {
        console.log(`  - ${col.TABLE_NAME}.${col.COLUMN_NAME}`);
      });
    }

    // Show institution_id columns
    const [institutionCols] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND COLUMN_NAME = 'institution_id'
    `);

    console.log('\n📋 Tables now using institution_id:');
    institutionCols.forEach(col => {
      console.log(`  - ${col.TABLE_NAME}`);
    });

    console.log('\n🎉 Database cleanup completed!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

cleanupinstitutionReferences();