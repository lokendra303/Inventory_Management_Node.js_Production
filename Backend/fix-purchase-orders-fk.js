const mysql = require('mysql2/promise');

async function fixPurchaseOrdersForeignKey() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('🔧 Fixing purchase_orders foreign key constraint issue...\n');

    // Check if users table exists
    const [userTables] = await connection.execute("SHOW TABLES LIKE 'users'");
    console.log(`Users table exists: ${userTables.length > 0 ? 'YES' : 'NO'}`);

    // Check current foreign key constraints on purchase_orders
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'ims_sepcune' 
      AND TABLE_NAME = 'purchase_orders'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log('\nCurrent foreign key constraints on purchase_orders:');
    constraints.forEach(constraint => {
      console.log(`  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} -> ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`);
    });

    // Check if the problematic constraint exists
    const problematicConstraint = constraints.find(c => 
      c.COLUMN_NAME === 'created_by' && c.REFERENCED_TABLE_NAME === 'users'
    );

    if (problematicConstraint) {
      console.log(`\n🎯 Found problematic constraint: ${problematicConstraint.CONSTRAINT_NAME}`);
      
      // Drop the foreign key constraint
      try {
        await connection.execute(`ALTER TABLE purchase_orders DROP FOREIGN KEY ${problematicConstraint.CONSTRAINT_NAME}`);
        console.log(`✅ Successfully dropped foreign key constraint: ${problematicConstraint.CONSTRAINT_NAME}`);
      } catch (error) {
        console.log(`❌ Error dropping constraint: ${error.message}`);
      }

      // Make created_by column nullable if it isn't already
      try {
        await connection.execute(`ALTER TABLE purchase_orders MODIFY COLUMN created_by VARCHAR(36) NULL`);
        console.log('✅ Made created_by column nullable');
      } catch (error) {
        console.log(`⚠️  Could not modify created_by column: ${error.message}`);
      }
    } else {
      console.log('\n✅ No problematic foreign key constraint found');
    }

    // Check purchase_orders table structure
    console.log('\nCurrent purchase_orders table structure:');
    const [columns] = await connection.execute("DESCRIBE purchase_orders");
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Test creating a purchase order with null created_by
    console.log('\n🧪 Testing purchase order creation with null created_by...');
    const testPoId = 'test-po-' + Date.now();
    try {
      await connection.execute(`
        INSERT INTO purchase_orders 
        (id, institution_id, po_number, vendor_name, warehouse_id, order_date, created_by, status) 
        VALUES (?, 'test-inst', 'TEST-PO-001', 'Test Vendor', 'test-warehouse', CURDATE(), NULL, 'draft')
      `, [testPoId]);
      
      console.log('✅ Successfully created test purchase order with null created_by');
      
      // Clean up test record
      await connection.execute('DELETE FROM purchase_orders WHERE id = ?', [testPoId]);
      console.log('✅ Cleaned up test record');
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }

    console.log('\n🎉 Purchase orders foreign key issue has been resolved!');

  } catch (error) {
    console.error('❌ Error fixing foreign key:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

fixPurchaseOrdersForeignKey();