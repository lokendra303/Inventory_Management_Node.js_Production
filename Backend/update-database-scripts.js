const fs = require('fs');
const path = require('path');

function updateDatabaseScripts() {
  const files = [
    'create-complete-database.js',
    'create-category-tables.js',
    'create-location-tables.js',
    'create-purchase-tables.js',
    'create-sales-tables.js',
    'create-reorder-tables.js',
    'create-api-keys-table.js',
    'create-bearer-tokens-table.js'
  ];

  const replacements = [
    { from: 'institution_id', to: 'institution_id' },
    { from: 'institutions', to: 'institutions' },
    { from: 'users', to: 'institution_users' },
    { from: 'unique_institution_', to: 'unique_institution_' },
    { from: 'idx_institution_', to: 'idx_institution_' },
    { from: 'REFERENCES institutions(id)', to: 'REFERENCES institutions(id)' },
    { from: 'REFERENCES users(id)', to: 'REFERENCES institution_users(id)' }
  ];

  files.forEach(fileName => {
    const filePath = path.join(__dirname, fileName);
    
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      
      replacements.forEach(({ from, to }) => {
        if (content.includes(from)) {
          content = content.replace(new RegExp(from, 'g'), to);
          changed = true;
        }
      });
      
      if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${fileName}`);
      }
    }
  });

  console.log('✅ All database scripts updated to use institution terminology!');
}

updateDatabaseScripts();