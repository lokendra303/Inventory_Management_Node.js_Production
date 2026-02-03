const fs = require('fs');
const path = require('path');

function fixRoutesFile() {
  const routesPath = path.join(__dirname, 'src', 'routes', 'index.js');
  
  let content = fs.readFileSync(routesPath, 'utf8');
  
  // Replace all institution references with institution references
  content = content.replace(/validateinstitutionConsistency/g, 'validateInstitutionConsistency');
  content = content.replace(/institutionId/g, 'institutionId');
  content = content.replace(/getinstitutionInventory/g, 'getInstitutionInventory');
  content = content.replace(/getinstitutionSettings/g, 'getInstitutionSettings');
  content = content.replace(/updateinstitutionSettings/g, 'updateInstitutionSettings');
  
  fs.writeFileSync(routesPath, content);
  console.log('✅ Routes file updated with institution terminology');
}

fixRoutesFile();