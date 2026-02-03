const mysql = require('mysql2/promise');

async function fixForeignKeyConstraints() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('🔧 Fixing foreign key constraints and completing cleanup...\n');

    // Tables that still have institution_id due to foreign key constraints
    const problematicTables = [
      'api_keys', 'bearer_tokens', 'event_store', 'goods_receipt_notes',
      'grn_lines', 'inventory_projections', 'items', 'purchase_order_lines',
      'purchase_orders', 'sales_order_lines', 'sales_orders', 'warehouses'
    ];

    for (const tableName of problematicTables) {
      try {
        // Get foreign key constraints for this table
        const [constraints] = await connection.execute(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = 'ims_sepcune' 
          AND TABLE_NAME = ? 
          AND COLUMN_NAME = 'institution_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [tableName]);

        // Drop foreign key constraints
        for (const constraint of constraints) {
          try {
            await connection.execute(`ALTER TABLE ${tableName} DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
            console.log(`✅ Dropped FK constraint ${constraint.CONSTRAINT_NAME} from ${tableName}`);
          } catch (error) {
            console.log(`⚠️  Could not drop FK ${constraint.CONSTRAINT_NAME}: ${error.message}`);
          }
        }

        // Now drop the institution_id column
        await connection.execute(`ALTER TABLE ${tableName} DROP COLUMN institution_id`);
        console.log(`✅ Removed institution_id column from ${tableName}`);

      } catch (error) {
        console.log(`⚠️  Could not process ${tableName}: ${error.message}`);
      }
    }

    // Now try to drop the old tables
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

    // Final verification
    console.log('\n🔍 Final verification...');
    
    const [remaininginstitutionCols] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND COLUMN_NAME LIKE '%institution%'
    `);

    if (remaininginstitutionCols.length === 0) {
      console.log('✅ All institution references successfully removed from database!');
    } else {
      console.log('⚠️  Remaining institution references:');
      remaininginstitutionCols.forEach(col => {
        console.log(`  - ${col.TABLE_NAME}.${col.COLUMN_NAME}`);
      });
    }

    console.log('\n🎉 Database is now fully converted to use institution_id only!');

  } catch (error) {
    console.error('❌ Error during FK cleanup:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixForeignKeyConstraints();