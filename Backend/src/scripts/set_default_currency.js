const db = require('../database/connection');

async function setDefaultCurrency() {
  try {
    await db.connect();
    
    console.log('Setting default currency to INR...');
    
    // Update all institutions to use INR
    const result = await db.query(`
      UPDATE institutions 
      SET currency = 'INR', currency_symbol = '₹'
    `);
    
    console.log(`Updated ${result.affectedRows} institution(s) to use INR currency`);
  } catch (error) {
    console.error('Error setting currency:', error);
  } finally {
    process.exit(0);
  }
}

setDefaultCurrency();