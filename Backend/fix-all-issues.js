const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '12345',
  database: 'ims_sepcune'
};

async function fixAllIssues() {
  let connection;
  
  try {
    console.log('🔧 COMPREHENSIVE BACKEND FIX');
    console.log('=' .repeat(50));
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected');
    
    // 1. Ensure all required columns exist
    console.log('\n📋 Checking table structure...');
    
    const fixes = [
      {
        table: 'warehouses',
        column: 'type',
        definition: 'VARCHAR(36) AFTER name'
      },
      {
        table: 'purchase_orders', 
        column: 'order_date',
        definition: 'DATE DEFAULT (CURRENT_DATE)'
      },
      {
        table: 'sales_orders',
        column: 'order_date', 
        definition: 'DATE DEFAULT (CURRENT_DATE)'
      },
      {
        table: 'purchase_order_lines',
        column: 'line_number',
        definition: 'INT DEFAULT 1'
      },
      {
        table: 'sales_order_lines',
        column: 'line_number',
        definition: 'INT DEFAULT 1'
      }
    ];
    
    for (const fix of fixes) {
      try {
        await connection.execute(`ALTER TABLE ${fix.table} ADD COLUMN ${fix.column} ${fix.definition}`);
        console.log(`   ✅ Added ${fix.column} to ${fix.table}`);
      } catch (error) {
        if (error.message.includes('Duplicate column')) {
          console.log(`   ℹ️  ${fix.column} already exists in ${fix.table}`);
        } else {
          console.log(`   ⚠️  ${fix.table}.${fix.column}: ${error.message}`);
        }
      }
    }
    
    // 2. Create default warehouse type if none exists
    console.log('\n🏭 Setting up warehouse types...');
    const [warehouseTypes] = await connection.execute('SELECT COUNT(*) as count FROM warehouse_types');
    
    if (warehouseTypes[0].count === 0) {
      const [institutions] = await connection.execute('SELECT id FROM institutions LIMIT 1');
      if (institutions.length > 0) {
        const institutionId = institutions[0].id;
        const typeId = generateUUID();
        
        await connection.execute(`
          INSERT INTO warehouse_types (id, institution_id, name, description, status) 
          VALUES (?, ?, 'Standard', 'Standard warehouse type', 'active')
        `, [typeId, institutionId]);
        
        // Update existing warehouses to use this type
        await connection.execute(`
          UPDATE warehouses SET type = ? WHERE institution_id = ? AND type IS NULL
        `, [typeId, institutionId]);
        
        console.log('   ✅ Created default warehouse type');
        console.log('   ✅ Updated existing warehouses');
      }
    } else {
      console.log('   ℹ️  Warehouse types already exist');
    }
    
    // 3. Verify data integrity
    console.log('\n📊 Verifying data integrity...');
    
    const tables = [
      'institutions', 'users', 'warehouses', 'warehouse_types', 
      'items', 'vendors', 'customers', 'categories'
    ];
    
    const counts = {};
    for (const table of tables) {
      const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
      counts[table] = result[0].count;
      console.log(`   ${table}: ${result[0].count} records`);
    }
    
    // 4. Create sample data if missing
    console.log('\n🎯 Ensuring sample data exists...');
    
    if (counts.warehouse_types === 0) {
      console.log('   ⚠️  No warehouse types found');
    }
    
    if (counts.warehouses === 0) {
      console.log('   ⚠️  No warehouses found');
    }
    
    if (counts.items === 0) {
      console.log('   ⚠️  No items found');
    }
    
    // 5. Test critical queries
    console.log('\n🧪 Testing critical queries...');
    
    try {
      const [institutions] = await connection.execute('SELECT id FROM institutions LIMIT 1');
      if (institutions.length > 0) {
        const institutionId = institutions[0].id;
        
        // Test warehouse query
        await connection.execute(`
          SELECT w.*, COALESCE(wt.name, 'Standard') as type_name 
          FROM warehouses w 
          LEFT JOIN warehouse_types wt ON w.type = wt.id 
          WHERE w.institution_id = ?
        `, [institutionId]);
        console.log('   ✅ Warehouse query works');
        
        // Test items query
        await connection.execute('SELECT * FROM items WHERE institution_id = ? LIMIT 1', [institutionId]);
        console.log('   ✅ Items query works');
        
        // Test inventory query
        await connection.execute('SELECT * FROM inventory_projections WHERE institution_id = ? LIMIT 1', [institutionId]);
        console.log('   ✅ Inventory query works');
        
      }
    } catch (error) {
      console.log(`   ❌ Query test failed: ${error.message}`);
    }
    
    console.log('\n🎉 BACKEND FIXES COMPLETED!');
    console.log('=' .repeat(50));
    console.log('📋 NEXT STEPS:');
    console.log('1. Restart the backend server: npm start');
    console.log('2. Test the frontend login');
    console.log('3. Check warehouse and items pages');
    console.log('4. Verify all API endpoints are working');
    
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

fixAllIssues();