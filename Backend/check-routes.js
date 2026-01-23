const fs = require('fs');
const path = require('path');

function checkRoutes() {
  console.log('🔍 Checking route configuration...\n');
  
  const routesDir = path.join(__dirname, 'src', 'routes');
  
  // Check if routes directory exists
  if (!fs.existsSync(routesDir)) {
    console.log('❌ Routes directory not found');
    return;
  }
  
  // List all route files
  const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));
  console.log('📁 Available route files:');
  routeFiles.forEach(file => {
    console.log(`   ✅ ${file}`);
  });
  
  // Check api.js configuration
  const apiRouterPath = path.join(routesDir, 'api.js');
  if (fs.existsSync(apiRouterPath)) {
    const apiContent = fs.readFileSync(apiRouterPath, 'utf8');
    
    console.log('\n🔗 Routes configured in api.js:');
    const routeMatches = apiContent.match(/router\.use\('\/([^']+)'/g);
    if (routeMatches) {
      routeMatches.forEach(match => {
        const route = match.match(/'\/([^']+)'/)[1];
        console.log(`   ✅ /api/${route}`);
      });
    }
  }
  
  // Check app.js configuration
  const appPath = path.join(__dirname, 'src', 'app.js');
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    console.log('\n🚀 App.js route configuration:');
    if (appContent.includes("require('./routes/api')")) {
      console.log('   ✅ Using centralized API router');
    } else {
      console.log('   ⚠️  Not using centralized API router');
    }
  }
  
  console.log('\n✅ Route check completed');
}

checkRoutes();