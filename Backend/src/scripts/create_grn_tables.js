const db = require('../database/connection');

async function createGRNTables() {
  try {
    await db.connect();
    
    console.log('Creating GRN tables...');
    
    // Create GRN header table
    await db.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_notes (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        grn_number VARCHAR(100) NOT NULL,
        po_id VARCHAR(36) NOT NULL,
        warehouse_id VARCHAR(36) NOT NULL,
        receipt_date DATE NOT NULL,
        received_by VARCHAR(36) NOT NULL,
        notes TEXT,
        status ENUM('draft', 'confirmed') DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
        FOREIGN KEY (received_by) REFERENCES users(id),
        UNIQUE KEY unique_institution_grn (institution_id, grn_number),
        INDEX idx_institution_po (institution_id, po_id)
      )
    `);
    
    // Create GRN lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS grn_lines (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        grn_id VARCHAR(36) NOT NULL,
        po_line_id VARCHAR(36) NOT NULL,
        item_id VARCHAR(36) NOT NULL,
        quantity_received DECIMAL(15,4) NOT NULL,
        unit_cost DECIMAL(15,4) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        quality_status ENUM('accepted', 'rejected', 'pending') DEFAULT 'accepted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
        FOREIGN KEY (po_line_id) REFERENCES purchase_order_lines(id),
        FOREIGN KEY (item_id) REFERENCES items(id),
        INDEX idx_grn (grn_id),
        INDEX idx_institution_item (institution_id, item_id)
      )
    `);
    
    console.log('GRN tables created successfully!');
  } catch (error) {
    console.error('Error creating GRN tables:', error);
  } finally {
    process.exit(0);
  }
}

createGRNTables();