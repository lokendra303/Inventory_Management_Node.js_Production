const fs = require('fs');
const path = require('path');

function findAllIssues() {
  console.log('🔍 Scanning for all missing methods and middleware issues...\n');

  // Check all route files for missing controller methods
  const routeFiles = [
    'src/routes/categories.js',
    'src/routes/items.js', 
    'src/routes/warehouses.js',
    'src/routes/inventory.js',
    'src/routes/vendors.js',
    'src/routes/customers.js',
    'src/routes/users.js',
    'src/routes/settings.js',
    'src/routes/purchase-orders.js',
    'src/routes/sales-orders.js'
  ];

  const controllerFiles = [
    'src/controllers/categoryController.js',
    'src/controllers/itemController.js',
    'src/controllers/warehouseController.js', 
    'src/controllers/inventoryController.js',
    'src/controllers/vendorController.js',
    'src/controllers/customerController.js',
    'src/controllers/purchaseOrderController.js',
    'src/controllers/salesOrderController.js'
  ];

  let issues = [];

  // Check route files for institution references
  routeFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (content.includes('validateinstitutionConsistency')) {
        issues.push(`${file}: Still using validateinstitutionConsistency`);
      }
      if (content.includes('extractinstitutionContext')) {
        issues.push(`${file}: Still using extractinstitutionContext`);
      }
    }
  });

  // Check controller files exist
  controllerFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      issues.push(`${file}: Controller file missing`);
    }
  });

  // Fix all institution references in route files
  routeFiles.forEach(file => {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      let changed = false;
      
      if (content.includes('validateinstitutionConsistency')) {
        content = content.replace(/validateinstitutionConsistency/g, 'validateInstitutionConsistency');
        changed = true;
      }
      if (content.includes('extractinstitutionContext')) {
        content = content.replace(/extractinstitutionContext/g, 'extractInstitutionContext');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(file, content);
        console.log(`✅ Fixed: ${file}`);
      }
    }
  });

  // Create missing controller files with basic structure
  const missingControllers = [
    'categoryController.js',
    'vendorController.js', 
    'customerController.js'
  ];

  missingControllers.forEach(controller => {
    const filePath = `src/controllers/${controller}`;
    if (!fs.existsSync(filePath)) {
      const controllerName = controller.replace('.js', '');
      const className = controllerName.charAt(0).toUpperCase() + controllerName.slice(1);
      
      const content = `const logger = require('../utils/logger');

class ${className} {
  async create${className.replace('Controller', '')}(req, res) {
    res.status(501).json({ success: false, error: 'Not implemented' });
  }

  async get${className.replace('Controller', '')}s(req, res) {
    res.status(501).json({ success: false, error: 'Not implemented' });
  }

  async get${className.replace('Controller', '')}(req, res) {
    res.status(501).json({ success: false, error: 'Not implemented' });
  }

  async update${className.replace('Controller', '')}(req, res) {
    res.status(501).json({ success: false, error: 'Not implemented' });
  }

  async delete${className.replace('Controller', '')}(req, res) {
    res.status(501).json({ success: false, error: 'Not implemented' });
  }
}

module.exports = new ${className}();`;

      fs.writeFileSync(filePath, content);
      console.log(`✅ Created: ${filePath}`);
    }
  });

  if (issues.length === 0) {
    console.log('✅ No issues found!');
  } else {
    console.log('⚠️  Issues found:');
    issues.forEach(issue => console.log(`   ${issue}`));
  }

  console.log('\n🎉 All fixes applied!');
}

findAllIssues();