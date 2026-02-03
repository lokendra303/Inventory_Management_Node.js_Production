const fs = require('fs');
const path = require('path');

function fixAllInstitutionIssues() {
  console.log('🔧 Fixing all institution-related issues...\n');

  // Files to update
  const filesToUpdate = [
    'src/routes/auth.js',
    'src/routes/users.js', 
    'src/routes/items.js',
    'src/routes/warehouses.js',
    'src/routes/inventory.js',
    'src/routes/vendors.js',
    'src/routes/customers.js',
    'src/routes/settings.js',
    'src/projections/inventoryProjections.js',
    'src/services/warehouseService.js',
    'src/services/itemService.js',
    'src/services/vendorService.js',
    'src/services/customerService.js'
  ];

  const replacements = [
    // Middleware references
    { from: 'validateinstitutionConsistency', to: 'validateInstitutionConsistency' },
    { from: 'extractinstitutionContext', to: 'extractInstitutionContext' },
    
    // Variable names
    { from: 'req\\.institutionId', to: 'req.institutionId' },
    { from: 'institutionId:', to: 'institutionId:' },
    { from: 'institutionId,', to: 'institutionId,' },
    { from: 'institutionId }', to: 'institutionId }' },
    { from: 'institutionId\\)', to: 'institutionId)' },
    
    // Method names
    { from: 'getinstitutionUsers', to: 'getInstitutionUsers' },
    { from: 'getinstitutionInventory', to: 'getInstitutionInventory' },
    { from: 'getinstitutionSettings', to: 'getInstitutionSettings' },
    { from: 'updateinstitutionSettings', to: 'updateInstitutionSettings' },
    
    // Comments and logs
    { from: 'institution', to: 'institution' },
    { from: 'institution', to: 'Institution' }
  ];

  let updatedCount = 0;

  filesToUpdate.forEach(file => {
    const fullPath = path.join(__dirname, file);
    
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      replacements.forEach(({ from, to }) => {
        const regex = new RegExp(from, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, to);
          changed = true;
        }
      });
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Updated: ${file}`);
        updatedCount++;
      }
    }
  });

  console.log(`\n🎉 Fixed ${updatedCount} files with institution terminology!`);
}

fixAllInstitutionIssues();