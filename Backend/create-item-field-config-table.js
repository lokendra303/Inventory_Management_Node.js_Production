const mysql = require('mysql2/promise');

async function createItemFieldConfigTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'ims_sepcune'
  });

  try {
    console.log('Creating item field configuration table...');

    // Create item_field_configs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS item_field_configs (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        item_type ENUM('simple', 'variant', 'composite', 'service') NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        field_label VARCHAR(255) NOT NULL,
        field_type ENUM('text', 'textarea', 'number', 'decimal', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'email', 'url', 'phone') NOT NULL,
        is_required BOOLEAN DEFAULT FALSE,
        validation_rules JSON,
        options JSON,
        default_value TEXT,
        display_order INT DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by VARCHAR(36),
        UNIQUE KEY unique_institution_type_field (institution_id, item_type, field_name),
        INDEX idx_institution_type (institution_id, item_type),
        INDEX idx_status (status)
      )
    `);

    // Insert default field configurations
    const defaultConfigs = [
      // Service item fields
      ['service', 'duration', 'Service Duration (hours)', 'number', true, '{"min": 0.5, "max": 24}', '[]', null, 1],
      ['service', 'serviceType', 'Service Type', 'select', true, '{}', '["Consultation", "Installation", "Maintenance", "Repair", "Training"]', null, 2],
      ['service', 'skillLevel', 'Required Skill Level', 'select', false, '{}', '["Basic", "Intermediate", "Advanced", "Expert"]', 'Basic', 3],
      ['service', 'location', 'Service Location', 'select', false, '{}', '["On-site", "Remote", "Workshop", "Customer Location"]', 'On-site', 4],
      ['service', 'prerequisites', 'Prerequisites', 'textarea', false, '{"maxLength": 500}', '[]', null, 5],
      
      // Simple product fields
      ['simple', 'weight', 'Weight (kg)', 'decimal', false, '{"min": 0}', '[]', null, 1],
      ['simple', 'dimensions', 'Dimensions (L×W×H)', 'text', false, '{"maxLength": 100}', '[]', null, 2],
      ['simple', 'color', 'Color', 'select', false, '{}', '["Red", "Blue", "Green", "Black", "White", "Yellow", "Orange", "Purple"]', null, 3],
      ['simple', 'material', 'Material', 'text', false, '{"maxLength": 100}', '[]', null, 4],
      ['simple', 'warranty', 'Warranty Period (months)', 'number', false, '{"min": 0, "max": 120}', '[]', null, 5],
      
      // Composite item fields
      ['composite', 'assemblyTime', 'Assembly Time (minutes)', 'number', false, '{"min": 1}', '[]', null, 1],
      ['composite', 'assemblyInstructions', 'Assembly Instructions', 'textarea', false, '{"maxLength": 1000}', '[]', null, 2],
      ['composite', 'toolsRequired', 'Tools Required', 'textarea', false, '{"maxLength": 500}', '[]', null, 3],
      
      // Variant item fields
      ['variant', 'size', 'Size', 'select', false, '{}', '["XS", "S", "M", "L", "XL", "XXL"]', null, 1],
      ['variant', 'variantColor', 'Color', 'select', false, '{}', '["Red", "Blue", "Green", "Black", "White"]', null, 2],
      ['variant', 'style', 'Style', 'text', false, '{"maxLength": 50}', '[]', null, 3]
    ];

    for (const config of defaultConfigs) {
      const configId = require('uuid').v4();
      await connection.execute(`
        INSERT IGNORE INTO item_field_configs 
        (id, institution_id, item_type, field_name, field_label, field_type, is_required, 
         validation_rules, options, default_value, display_order, created_by)
        VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system')
      `, [configId, ...config]);
    }

    console.log('✅ Item field configuration table created successfully!');
    console.log('✅ Default field configurations inserted!');

  } catch (error) {
    console.error('❌ Error creating item field configuration table:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createItemFieldConfigTable();