const mysql = require('mysql2/promise');

async function fixInstitutionColumns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Adding institution_id columns and copying data...');

    const tablesToFix = [
      'purchase_orders', 'purchase_order_lines', 'vendors', 
      'goods_receipt_notes', 'grn_lines'
    ];

    for (const table of tablesToFix) {
      try {
        // Check if table exists and has tenant_id column
        const [tenantIdExists] = await connection.execute(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'ims_sepcune' AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'
        `, [table]);
        
        // Check if institution_id column already exists
        const [institutionIdExists] = await connection.execute(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'ims_sepcune' AND TABLE_NAME = ? AND COLUMN_NAME = 'institution_id'
        `, [table]);
        
        if (tenantIdExists.length > 0 && institutionIdExists.length === 0) {
          // Add institution_id column
          await connection.execute(`
            ALTER TABLE ${table} ADD COLUMN institution_id VARCHAR(36) AFTER tenant_id
          `);
          
          // Copy tenant_id values to institution_id
          await connection.execute(`
            UPDATE ${table} SET institution_id = tenant_id WHERE tenant_id IS NOT NULL
          `);
          
          console.log(`✅ Added institution_id column to ${table}`);
        } else if (institutionIdExists.length > 0) {
          console.log(`ℹ️  ${table} already has institution_id column`);
        } else {
          console.log(`⚠️  ${table} doesn't have tenant_id column`);
        }
      } catch (error) {
        console.log(`❌ Error fixing ${table}: ${error.message}`);
      }
    }

    console.log('✅ Institution columns fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run fix
if (require.main === module) {
  fixInstitutionColumns()
    .then(() => {
      console.log('Fix script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fix script failed:', error);
      process.exit(1);
    });
}

module.exports = fixInstitutionColumns;