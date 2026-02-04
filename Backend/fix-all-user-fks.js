const mysql = require('mysql2/promise');

async function fixAllUserForeignKeys() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('🔧 Fixing all foreign key constraints that reference users table...\n');

    // Check if users table exists
    const [userTables] = await connection.execute("SHOW TABLES LIKE 'users'");
    console.log(`Users table exists: ${userTables.length > 0 ? 'YES' : 'NO'}`);

    if (userTables.length > 0) {
      console.log('✅ Users table exists, no need to fix foreign keys');
      return;
    }

    // Find all foreign key constraints that reference users table
    const [constraints] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND REFERENCED_TABLE_NAME = 'users'
    `);

    console.log('Foreign key constraints referencing users table:');
    constraints.forEach(constraint => {
      console.log(`  - ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME} (${constraint.CONSTRAINT_NAME})`);
    });

    // Drop each foreign key constraint
    for (const constraint of constraints) {
      try {
        await connection.execute(`ALTER TABLE ${constraint.TABLE_NAME} DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}`);
        console.log(`✅ Dropped FK constraint: ${constraint.TABLE_NAME}.${constraint.CONSTRAINT_NAME}`);
        
        // Make the column nullable if it's a user reference column
        if (constraint.COLUMN_NAME.includes('_by') || constraint.COLUMN_NAME === 'user_id') {
          try {
            await connection.execute(`ALTER TABLE ${constraint.TABLE_NAME} MODIFY COLUMN ${constraint.COLUMN_NAME} VARCHAR(36) NULL`);
            console.log(`✅ Made ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} nullable`);
          } catch (error) {
            console.log(`⚠️  Could not modify ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`❌ Error dropping ${constraint.TABLE_NAME}.${constraint.CONSTRAINT_NAME}: ${error.message}`);
      }
    }

    // Check for any remaining constraints
    const [remainingConstraints] = await connection.execute(`
      SELECT 
        TABLE_NAME,
        CONSTRAINT_NAME,
        COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND REFERENCED_TABLE_NAME = 'users'
    `);

    if (remainingConstraints.length === 0) {
      console.log('\n✅ All foreign key constraints referencing users table have been removed!');
    } else {
      console.log('\n⚠️  Some constraints could not be removed:');
      remainingConstraints.forEach(constraint => {
        console.log(`  - ${constraint.TABLE_NAME}.${constraint.COLUMN_NAME} (${constraint.CONSTRAINT_NAME})`);
      });
    }

    console.log('\n🎉 User foreign key cleanup completed!');

  } catch (error) {
    console.error('❌ Error fixing foreign keys:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixAllUserForeignKeys();