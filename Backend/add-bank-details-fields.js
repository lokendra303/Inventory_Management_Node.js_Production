const mysql = require('mysql2/promise');

async function addBankDetailsFields() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Adding bank details fields to vendors and customers tables...');

    // Bank details fields to add
    const bankFields = [
      'bank_name VARCHAR(255)',
      'account_holder_name VARCHAR(255)',
      'account_number VARCHAR(50)',
      'ifsc_code VARCHAR(20)',
      'branch_name VARCHAR(255)',
      'account_type ENUM("savings", "current", "cc", "od") DEFAULT "current"',
      'swift_code VARCHAR(20)',
      'iban VARCHAR(50)'
    ];

    // Add bank fields to vendors table
    console.log('Adding bank fields to vendors table...');
    for (const field of bankFields) {
      try {
        await connection.execute(`ALTER TABLE vendors ADD COLUMN ${field}`);
        console.log(`  ✅ Added ${field.split(' ')[0]} to vendors`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⚠️  Field ${field.split(' ')[0]} already exists in vendors`);
        } else {
          throw error;
        }
      }
    }

    // Add bank fields to customers table
    console.log('Adding bank fields to customers table...');
    for (const field of bankFields) {
      try {
        await connection.execute(`ALTER TABLE customers ADD COLUMN ${field}`);
        console.log(`  ✅ Added ${field.split(' ')[0]} to customers`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⚠️  Field ${field.split(' ')[0]} already exists in customers`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Bank details fields added successfully!');

  } catch (error) {
    console.error('❌ Error adding bank details fields:', error.message);
  } finally {
    await connection.end();
  }
}

addBankDetailsFields();