const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const backendDir = __dirname;
const queryFiles = [
  'activate-user.js',
  'add-item-fields.js',
  'add-mobile-unique-email.js',
  'add-price-columns.js',
  'add-user-fields.js',
  'check-features.js',
  'check-inventory.js',
  'check-items.js',
  'clean-duplicates.js',
  'create-api-keys-table.js',
  'create-bearer-tokens-table.js',
  'create-category-tables.js',
  'create-location-tables.js',
  'create-purchase-tables.js',
  'create-reorder-tables.js',
  'create-sales-tables.js',
  'create-test-projection.js',
  'fix-subdomain.js',
  'update-role-column.js'
];

async function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 Running: ${path.basename(scriptPath)}`);
    
    const child = spawn('node', [scriptPath], {
      cwd: backendDir,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      
      if (code === 0) {
        console.log(`✅ ${path.basename(scriptPath)} completed`);
        resolve();
      } else {
        console.log(`⚠️  ${path.basename(scriptPath)} exited with code ${code}`);
        resolve(); // Continue with other scripts
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Error running ${path.basename(scriptPath)}:`, error.message);
      resolve(); // Continue with other scripts
    });
  });
}

async function runAllScripts() {
  console.log('🚀 Running all query scripts...\n');
  
  for (const file of queryFiles) {
    const scriptPath = path.join(backendDir, file);
    
    if (fs.existsSync(scriptPath)) {
      await runScript(scriptPath);
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }
  
  console.log('\n🎉 All scripts completed!');
}

runAllScripts().catch(console.error);