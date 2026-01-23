const db = require('./src/database/connection');

async function addPriceColumns() {
  try {
    await db.connect();
    
    const columns = [
      'cost_price DECIMAL(15,4) DEFAULT 0',
      'selling_price DECIMAL(15,4) DEFAULT 0', 
      'mrp DECIMAL(15,4) DEFAULT 0',
      'tax_rate DECIMAL(5,2) DEFAULT 0',
      'tax_type ENUM("inclusive", "exclusive") DEFAULT "exclusive"',
      'weight DECIMAL(10,3) DEFAULT 0',
      'weight_unit VARCHAR(10) DEFAULT "kg"',
      'dimensions VARCHAR(100)',
      'brand VARCHAR(100)',
      'manufacturer VARCHAR(100)',
      'supplier_code VARCHAR(50)',
      'min_stock_level DECIMAL(15,4) DEFAULT 0',
      'max_stock_level DECIMAL(15,4) DEFAULT 0',
      'is_serialized BOOLEAN DEFAULT FALSE',
      'is_batch_tracked BOOLEAN DEFAULT FALSE',
      'has_expiry BOOLEAN DEFAULT FALSE',
      'shelf_life_days INT',
      'storage_conditions TEXT',
      'item_group VARCHAR(100)',
      'purchase_account VARCHAR(100)',
      'sales_account VARCHAR(100)',
      'opening_stock DECIMAL(15,4) DEFAULT 0',
      'opening_value DECIMAL(15,2) DEFAULT 0',
      'as_of_date DATE'
    ];
    
    for (const column of columns) {
      try {
        await db.query(`ALTER TABLE items ADD COLUMN ${column}`);
        console.log(`Added column: ${column.split(' ')[0]}`);
      } catch (error) {
        if (error.message.includes('Duplicate column name')) {
          console.log(`Column already exists: ${column.split(' ')[0]}`);
        } else {
          console.error(`Error adding column ${column.split(' ')[0]}:`, error.message);
        }
      }
    }
    
    console.log('Price columns update completed');
    process.exit(0);
  } catch (error) {
    console.error('Error updating price columns:', error);
    process.exit(1);
  }
}

addPriceColumns();