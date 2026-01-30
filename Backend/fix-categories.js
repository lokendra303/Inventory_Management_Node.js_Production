const fs = require('fs');

const filePath = 'src/routes/categories.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/validateinstitutionConsistency/g, 'validateInstitutionConsistency');

fs.writeFileSync(filePath, content);
console.log('✅ Fixed categories.js');