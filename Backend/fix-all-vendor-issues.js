const mysql = require('mysql2/promise');

async function fixAllVendorIssues() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('🔧 Fixing all vendor-related issues...\n');

    // 1. Ensure vendors table has correct structure
    console.log('1. Checking vendors table structure...');
    const [vendorColumns] = await connection.execute("DESCRIBE vendors");
    const requiredColumns = [
      'id', 'tenant_id', 'vendor_code', 'display_name', 'company_name',
      'salutation', 'first_name', 'last_name', 'email', 'work_phone',
      'mobile_phone', 'pan', 'gstin', 'msme_registered', 'currency',
      'payment_terms', 'tds', 'website_url', 'department', 'designation',
      'billing_attention', 'billing_country', 'billing_address1', 'billing_address2',
      'billing_city', 'billing_state', 'billing_pin_code',
      'shipping_attention', 'shipping_country', 'shipping_address1', 'shipping_address2',
      'shipping_city', 'shipping_state', 'shipping_pin_code', 'remarks',
      'lead_time_days', 'status', 'created_at', 'updated_at'
    ];

    const existingColumns = vendorColumns.map(col => col.Field);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log(`   Missing columns: ${missingColumns.join(', ')}`);
      // Add missing columns if needed
      for (const column of missingColumns) {
        let columnDef = '';
        switch (column) {
          case 'vendor_code':
            columnDef = 'VARCHAR(50)';
            break;
          case 'display_name':
            columnDef = 'VARCHAR(255) NOT NULL';
            break;
          case 'company_name':
          case 'email':
          case 'website_url':
          case 'billing_attention':
          case 'shipping_attention':
            columnDef = 'VARCHAR(255)';
            break;
          case 'salutation':
            columnDef = 'VARCHAR(10)';
            break;
          case 'first_name':
          case 'last_name':
          case 'billing_country':
          case 'billing_city':
          case 'billing_state':
          case 'shipping_country':
          case 'shipping_city':
          case 'shipping_state':
          case 'department':
          case 'designation':
          case 'payment_terms':
            columnDef = 'VARCHAR(100)';
            break;
          case 'work_phone':
          case 'mobile_phone':
          case 'tds':
            columnDef = 'VARCHAR(50)';
            break;
          case 'pan':
          case 'gstin':
          case 'billing_pin_code':
          case 'shipping_pin_code':
            columnDef = 'VARCHAR(20)';
            break;
          case 'currency':
            columnDef = "VARCHAR(3) DEFAULT 'INR'";
            break;
          case 'msme_registered':
            columnDef = 'BOOLEAN DEFAULT FALSE';
            break;
          case 'billing_address1':
          case 'billing_address2':
          case 'shipping_address1':
          case 'shipping_address2':
          case 'remarks':
            columnDef = 'TEXT';
            break;
          case 'lead_time_days':
            columnDef = 'INT DEFAULT 7';
            break;
          case 'status':
            columnDef = "ENUM('active', 'inactive') DEFAULT 'active'";
            break;
          case 'created_at':
            columnDef = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
            break;
          case 'updated_at':
            columnDef = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
            break;
        }
        if (columnDef) {
          await connection.execute(`ALTER TABLE vendors ADD COLUMN ${column} ${columnDef}`);
          console.log(`   ✅ Added column: ${column}`);
        }
      }
    } else {
      console.log('   ✅ All required columns exist');
    }

    // 2. Check if we have test data
    console.log('\n2. Checking test data...');
    const [tenants] = await connection.execute("SELECT id FROM tenants LIMIT 1");
    if (tenants.length === 0) {
      console.log('   ❌ No tenants found - please run setup-test-data.js first');
      return;
    }
    const tenantId = tenants[0].id;
    console.log(`   ✅ Using tenant ID: ${tenantId}`);

    // 3. Test vendor creation
    console.log('\n3. Testing vendor creation...');
    const testVendorData = {
      displayName: 'Test Vendor Company',
      companyName: 'Test Vendor Company Ltd',
      salutation: 'mr',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@testvendor.com',
      workPhone: '1234567890',
      mobilePhone: '9876543210',
      currency: 'INR',
      paymentTerms: 'net_30',
      msmeRegistered: false,
      billingCity: 'Mumbai',
      billingState: 'Maharashtra',
      billingCountry: 'India'
    };

    // Clean up any existing test vendor
    await connection.execute(
      "DELETE FROM vendors WHERE tenant_id = ? AND display_name = ?",
      [tenantId, testVendorData.displayName]
    );

    // Test insert
    const testVendorId = `test-vendor-${Date.now()}`;
    const vendorCode = `VEN-${Date.now()}`;

    await connection.execute(`
      INSERT INTO vendors (
        id, tenant_id, vendor_code, display_name, company_name, salutation,
        first_name, last_name, email, work_phone, mobile_phone, currency,
        payment_terms, msme_registered, billing_city, billing_state,
        billing_country, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      testVendorId, tenantId, vendorCode, testVendorData.displayName,
      testVendorData.companyName, testVendorData.salutation,
      testVendorData.firstName, testVendorData.lastName, testVendorData.email,
      testVendorData.workPhone, testVendorData.mobilePhone, testVendorData.currency,
      testVendorData.paymentTerms, testVendorData.msmeRegistered ? 1 : 0,
      testVendorData.billingCity, testVendorData.billingState,
      testVendorData.billingCountry
    ]);

    console.log('   ✅ Test vendor created successfully');

    // 4. Test vendor retrieval
    console.log('\n4. Testing vendor retrieval...');
    const [vendors] = await connection.execute(
      "SELECT * FROM vendors WHERE tenant_id = ? AND id = ?",
      [tenantId, testVendorId]
    );

    if (vendors.length > 0) {
      console.log('   ✅ Test vendor retrieved successfully');
      console.log(`   Vendor: ${vendors[0].display_name} (${vendors[0].vendor_code})`);
    } else {
      console.log('   ❌ Failed to retrieve test vendor');
    }

    // 5. Clean up test data
    await connection.execute(
      "DELETE FROM vendors WHERE tenant_id = ? AND id = ?",
      [tenantId, testVendorId]
    );
    console.log('   ✅ Test vendor cleaned up');

    console.log('\n🎉 All vendor issues have been fixed!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Try creating a vendor from the frontend');
    console.log('3. Check that the vendors list loads properly');

  } catch (error) {
    console.error('❌ Error fixing vendor issues:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await connection.end();
  }
}

fixAllVendorIssues();