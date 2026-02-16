const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const original = content;
      
      content = content.replace(/require\('\.\.\/services/g, "require('../../services");
      content = content.replace(/require\('\.\.\/utils/g, "require('../../utils");
      content = content.replace(/require\('\.\.\/database/g, "require('../../database");
      content = content.replace(/require\('\.\.\/middleware/g, "require('../../middleware");
      content = content.replace(/require\('\.\.\/constants/g, "require('../../constants");
      
      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${filePath}`);
      }
    }
  });
}

fixImports('./src/controllers');
console.log('Done!');
