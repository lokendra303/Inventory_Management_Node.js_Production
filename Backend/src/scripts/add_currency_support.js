const db = require('../database/connection');

async function addCurrencySupport() {
  try {
    await db.connect();
    
    console.log('Adding currency support to database...');
    
    // Add currency column to tenants table
    try {
      await db.query(`ALTER TABLE tenants ADD COLUMN currency VARCHAR(3) DEFAULT 'USD'`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    try {
      await db.query(`ALTER TABLE tenants ADD COLUMN currency_symbol VARCHAR(10) DEFAULT '$'`);
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) throw e;
    }
    
    console.log('Currency support added successfully!');
  } catch (error) {
    console.error('Error adding currency support:', error);
  } finally {
    process.exit(0);
  }
}

addCurrencySupport();