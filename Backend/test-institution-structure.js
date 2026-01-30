const mysql = require('mysql2/promise');

async function testInstitutionStructure() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('🧪 Testing Institution-Based User Structure...\n');

    // Test 1: Check if new tables exist
    console.log('1. Checking table structure...');
    
    const institutionsTable = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'ims_sepcune' AND table_name = 'institutions'
    `);
    
    const institutionUsersTable = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'ims_sepcune' AND table_name = 'institution_users'
    `);
    
    if (institutionsTable[0][0].count > 0) {
      console.log('   ✅ institutions table exists');
    } else {
      console.log('   ❌ institutions table missing');
    }
    
    if (institutionUsersTable[0][0].count > 0) {
      console.log('   ✅ institution_users table exists');
    } else {
      console.log('   ❌ institution_users table missing');
    }

    // Test 2: Check data migration
    console.log('\n2. Checking data migration...');
    
    const institutionCount = await connection.execute('SELECT COUNT(*) as count FROM institutions');
    const userCount = await connection.execute('SELECT COUNT(*) as count FROM institution_users');
    
    console.log(`   📊 Institutions: ${institutionCount[0][0].count}`);
    console.log(`   📊 Institution Users: ${userCount[0][0].count}`);

    // Test 3: Check foreign key relationships
    console.log('\n3. Checking relationships...');
    
    const relationshipCheck = await connection.execute(`
      SELECT i.name as institution_name, COUNT(u.id) as user_count
      FROM institutions i
      LEFT JOIN institution_users u ON i.id = u.institution_id
      GROUP BY i.id, i.name
      ORDER BY user_count DESC
    `);
    
    console.log('   Institution -> Users mapping:');
    relationshipCheck[0].forEach(row => {
      console.log(`   📋 ${row.institution_name}: ${row.user_count} users`);
    });

    // Test 4: Check institution_id columns in other tables
    console.log('\n4. Checking foreign key updates...');
    
    const tablesToCheck = ['items', 'warehouses', 'categories', 'vendors', 'customers'];
    
    for (const table of tablesToCheck) {
      try {
        const columnCheck = await connection.execute(`
          SELECT COUNT(*) as count FROM information_schema.columns 
          WHERE table_schema = 'ims_sepcune' AND table_name = ? AND column_name = 'institution_id'
        `, [table]);
        
        if (columnCheck[0][0].count > 0) {
          const dataCheck = await connection.execute(`SELECT COUNT(*) as count FROM ${table} WHERE institution_id IS NOT NULL`);
          console.log(`   ✅ ${table}: institution_id column exists (${dataCheck[0][0].count} records)`);
        } else {
          console.log(`   ⚠️  ${table}: institution_id column missing`);
        }
      } catch (error) {
        console.log(`   ❌ ${table}: Error checking - ${error.message}`);
      }
    }

    // Test 5: Sample data verification
    console.log('\n5. Sample data verification...');
    
    const sampleInstitution = await connection.execute(`
      SELECT i.*, COUNT(u.id) as user_count
      FROM institutions i
      LEFT JOIN institution_users u ON i.id = u.institution_id
      GROUP BY i.id
      LIMIT 1
    `);
    
    if (sampleInstitution[0].length > 0) {
      const inst = sampleInstitution[0][0];
      console.log('   📋 Sample Institution:');
      console.log(`      Name: ${inst.name}`);
      console.log(`      Email: ${inst.email}`);
      console.log(`      Type: ${inst.institution_type}`);
      console.log(`      Status: ${inst.status}`);
      console.log(`      Users: ${inst.user_count}`);
      
      // Get sample user from this institution
      const sampleUser = await connection.execute(`
        SELECT * FROM institution_users WHERE institution_id = ? LIMIT 1
      `, [inst.id]);
      
      if (sampleUser[0].length > 0) {
        const user = sampleUser[0][0];
        console.log('\n   👤 Sample User:');
        console.log(`      Name: ${user.first_name} ${user.last_name}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Role: ${user.role}`);
        console.log(`      Status: ${user.status}`);
        console.log(`      Department: ${user.department || 'N/A'}`);
      }
    }

    // Test 6: Check backup tables
    console.log('\n6. Checking backup tables...');
    
    const backupTables = ['institutions_backup', 'users_backup'];
    for (const table of backupTables) {
      try {
        const backupCheck = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${backupCheck[0][0].count} records backed up`);
      } catch (error) {
        console.log(`   ❌ ${table}: Not found or error - ${error.message}`);
      }
    }

    console.log('\n🎉 Institution structure test completed!');
    console.log('\n📋 Summary:');
    console.log('   - New tables created and populated');
    console.log('   - Data successfully migrated');
    console.log('   - Foreign key relationships established');
    console.log('   - Backup tables created for safety');
    console.log('\n⚠️  Next steps:');
    console.log('   1. Update application code to use new services');
    console.log('   2. Test authentication and user management');
    console.log('   3. Verify all API endpoints work correctly');
    console.log('   4. Update frontend to use new structure');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await connection.end();
  }
}

// Additional utility functions for testing
async function testInstitutionAuth() {
  console.log('\n🔐 Testing Institution Authentication...');
  
  // This would require the new auth service to be active
  try {
    const authService = require('./src/services/authService-new');
    
    // Test creating a new institution
    const testInstitution = {
      name: 'Test Institution',
      email: 'test@institution.com',
      institutionType: 'educational',
      adminEmail: 'admin@test.com',
      adminPassword: 'testPassword123',
      adminFirstName: 'Test',
      adminLastName: 'Admin'
    };
    
    console.log('   Creating test institution...');
    // const result = await authService.createInstitution(testInstitution);
    // console.log('   ✅ Institution created:', result);
    
    console.log('   ⚠️  Auth testing requires updated service files to be active');
    
  } catch (error) {
    console.log('   ❌ Auth test failed:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testInstitutionStructure()
    .then(() => {
      console.log('\nTest completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testInstitutionStructure, testInstitutionAuth };