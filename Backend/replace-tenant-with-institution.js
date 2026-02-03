const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  
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
    console.log(`✅ Updated: ${filePath}`);
  }
}

function updateAllFiles() {
  const replacements = [
    // Database column names
    { from: 'institution_id', to: 'institution_id' },
    { from: 'institution_status', to: 'institution_status' },
    
    // Variable names
    { from: 'institutionId', to: 'institutionId' },
    { from: 'institutionData', to: 'institutionData' },
    { from: 'institutionName', to: 'institutionName' },
    { from: 'institutionEmail', to: 'institutionEmail' },
    
    // Object properties
    { from: 'req\\.institutionId', to: 'req.institutionId' },
    { from: 'user\\.institutionId', to: 'user.institutionId' },
    { from: '\\.institutionId', to: '.institutionId' },
    
    // Table names
    { from: 'institutions', to: 'institutions' },
    { from: 'users', to: 'institution_users' },
    
    // Method names
    { from: 'createinstitution', to: 'createInstitution' },
    { from: 'getinstitutionUsers', to: 'getInstitutionUsers' },
    { from: 'getinstitutionBySubdomain', to: 'getInstitutionByEmail' },
    { from: 'updateinstitutionSettings', to: 'updateInstitutionSettings' },
    { from: 'extractinstitutionContext', to: 'extractInstitutionContext' },
    { from: 'validateinstitutionConsistency', to: 'validateInstitutionConsistency' },
    
    // Comments and logs
    { from: 'institution', to: 'institution' },
    { from: 'institution', to: 'Institution' },
    { from: 'institution', to: 'INSTITUTION' }
  ];

  const filesToUpdate = [
    'src/services/authService.js',
    'src/controllers/authController.js',
    'src/middleware/auth.js',
    'src/routes/auth.js',
    'src/services/inventoryService.js',
    'src/services/itemService.js',
    'src/services/warehouseService.js',
    'src/services/vendorService.js',
    'src/services/customerService.js',
    'src/controllers/inventoryController.js',
    'src/controllers/itemController.js',
    'src/controllers/warehouseController.js',
    'src/controllers/vendorController.js',
    'src/controllers/customerController.js'
  ];

  console.log('🔄 Replacing all institution references with institution references...\n');

  filesToUpdate.forEach(file => {
    const fullPath = path.join(__dirname, file);
    replaceInFile(fullPath, replacements);
  });

  console.log('\n✅ All institution references replaced with institution references!');
}

updateAllFiles();