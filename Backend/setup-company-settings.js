const db = require('./src/database/connection');
const fs = require('fs');
const path = require('path');
const logger = require('./src/utils/logger');

async function setupCompanySettings() {
  try {
    console.log('Setting up company settings table...');

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'src/database/migrations/create-company-settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await db.query(sql);

    console.log('✓ Company settings table created successfully');

    // Create upload directories
    const uploadDirs = [
      path.join(__dirname, 'uploads/company/logos'),
      path.join(__dirname, 'uploads/company/stamps'),
      path.join(__dirname, 'uploads/company/signatures')
    ];

    uploadDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
      }
    });

    console.log('\n✓ Company settings feature setup completed successfully!');
    console.log('\nYou can now:');
    console.log('1. Navigate to Settings → Company Settings in the application');
    console.log('2. Upload your company logo, stamp, and signature');
    console.log('3. Generate professional invoices with your branding');

    process.exit(0);
  } catch (error) {
    console.error('Error setting up company settings:', error);
    logger.error('Setup error:', error);
    process.exit(1);
  }
}

setupCompanySettings();
