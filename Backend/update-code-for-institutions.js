const fs = require('fs');
const path = require('path');

function updateAuthService() {
  const authServicePath = path.join(__dirname, 'src', 'services', 'authService.js');
  
  // Read current auth service
  let content = fs.readFileSync(authServicePath, 'utf8');
  
  // Replace institution references with institution references
  content = content.replace(/institutions/g, 'institutions');
  content = content.replace(/users/g, 'institution_users');
  content = content.replace(/institution_id/g, 'institution_id');
  content = content.replace(/institutionId/g, 'institutionId');
  
  // Update specific queries
  content = content.replace(
    /SELECT u\.\*, t\.status as institution_status FROM users u JOIN institutions t ON u\.institution_id = t\.id/g,
    'SELECT u.*, i.status as institution_status FROM institution_users u JOIN institutions i ON u.institution_id = i.id'
  );
  
  content = content.replace(
    /institution_status/g,
    'institution_status'
  );
  
  // Write updated content
  fs.writeFileSync(authServicePath, content);
  console.log('✅ Updated authService.js');
}

function updateAuthController() {
  const authControllerPath = path.join(__dirname, 'src', 'controllers', 'authController.js');
  
  // Read current auth controller
  let content = fs.readFileSync(authControllerPath, 'utf8');
  
  // Replace institution references with institution references
  content = content.replace(/institutionId/g, 'institutionId');
  content = content.replace(/req\.institutionId/g, 'req.institutionId');
  
  // Write updated content
  fs.writeFileSync(authControllerPath, content);
  console.log('✅ Updated authController.js');
}

function updateMiddleware() {
  const middlewarePath = path.join(__dirname, 'src', 'middleware', 'auth.js');
  
  // Read current middleware
  let content = fs.readFileSync(middlewarePath, 'utf8');
  
  // Add institution context extraction
  content = content.replace(
    /req\.institutionId = decoded\.institutionId;/g,
    'req.institutionId = decoded.institutionId || decoded.institutionId; req.institutionId = req.institutionId;'
  );
  
  content = content.replace(
    /institutionId: decoded\.institutionId/g,
    'institutionId: decoded.institutionId || decoded.institutionId, institutionId: decoded.institutionId || decoded.institutionId'
  );
  
  // Write updated content
  fs.writeFileSync(middlewarePath, content);
  console.log('✅ Updated auth middleware');
}

// Run updates
console.log('Updating application code for new table structure...\n');

try {
  updateAuthService();
  updateAuthController();
  updateMiddleware();
  
  console.log('\n🎉 Application code updated successfully!');
  console.log('\n📋 Changes made:');
  console.log('   - Updated database table references');
  console.log('   - Added backward compatibility');
  console.log('   - Updated query structures');
  console.log('\n⚠️  Test the application to ensure everything works correctly');
  
} catch (error) {
  console.error('❌ Error updating code:', error.message);
}