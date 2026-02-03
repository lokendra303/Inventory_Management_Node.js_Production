const fs = require('fs');
const path = require('path');

function fixAllRoutes() {
  console.log('🔧 Fixing all route files...\n');

  // Get all route files
  const routesDir = 'src/routes';
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

  files.forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Fix middleware imports
    if (content.includes('validateinstitutionConsistency')) {
      content = content.replace(/validateinstitutionConsistency/g, 'validateInstitutionConsistency');
      changed = true;
    }

    if (content.includes('extractinstitutionContext')) {
      content = content.replace(/extractinstitutionContext/g, 'extractInstitutionContext');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${file}`);
    }
  });

  console.log('\n🎉 All route files fixed!');
}

fixAllRoutes();