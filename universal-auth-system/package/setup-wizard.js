#!/usr/bin/env node

// quick-setup.js - One-command setup for Universal Auth

const fs = require('fs');
const path = require('path');

console.log('🚀 Universal Auth Quick Setup\n');

// 1. Create package.json if not exists
if (!fs.existsSync('package.json')) {
  const packageJson = {
    "name": "my-app-with-auth",
    "version": "1.0.0",
    "main": "app.js",
    "scripts": {
      "start": "node app.js",
      "dev": "nodemon app.js"
    },
    "dependencies": {
      "@yourcompany/universal-auth": "^1.0.0",
      "express": "^4.18.0",
      "mysql2": "^3.6.0",
      "bcryptjs": "^2.4.3",
      "jsonwebtoken": "^9.0.0",
      "uuid": "^9.0.0",
      "dotenv": "^16.0.0"
    },
    "devDependencies": {
      "nodemon": "^3.0.0"
    }
  };
  
  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  console.log('✅ Created package.json');
}

// 2. Create .env file
const envContent = `# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_app_db

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3000
NODE_ENV=development
`;

fs.writeFileSync('.env', envContent);
console.log('✅ Created .env file');

// 3. Create basic app.js
const appContent = `const express = require('express');
const mysql = require('mysql2/promise');
const { UniversalAuth, AuthController, AuthMiddleware, migrations } = require('@yourcompany/universal-auth');
require('dotenv').config();

class App {
  async init() {
    this.app = express();
    this.app.use(express.json());
    
    // Database connection
    this.db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Database connected');
    
    // Run auth migrations
    await migrations.runMigrations(this.db);
    console.log('✅ Auth tables created');
    
    // Initialize auth
    this.authService = new UniversalAuth({
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      database: this.db
    });
    
    this.authController = new AuthController(this.authService);
    this.authMiddleware = new AuthMiddleware(this.authService);
    
    this.setupRoutes();
  }
  
  setupRoutes() {
    // Health check
    this.app.get('/', (req, res) => {
      res.json({ 
        message: 'Universal Auth App Running!',
        endpoints: {
          'POST /api/auth/register': 'Register new company',
          'POST /api/auth/login': 'User login',
          'GET /api/auth/profile': 'Get profile (requires token)',
          'GET /api/protected': 'Protected route example'
        }
      });
    });
    
    // Auth routes
    const auth = express.Router();
    auth.post('/register', this.authController.registerTenant.bind(this.authController));
    auth.post('/login', this.authController.login.bind(this.authController));
    auth.post('/refresh', this.authController.refreshToken.bind(this.authController));
    
    // Protected routes
    auth.use(this.authMiddleware.authenticate());
    auth.get('/profile', this.authController.getProfile.bind(this.authController));
    auth.post('/change-password', this.authController.changePassword.bind(this.authController));
    
    // Admin routes
    auth.use(this.authMiddleware.requireRole('admin'));
    auth.post('/users', this.authController.createUser.bind(this.authController));
    auth.get('/users', this.authController.getUsers.bind(this.authController));
    
    this.app.use('/api/auth', auth);
    
    // Example protected route
    this.app.get('/api/protected', 
      this.authMiddleware.authenticate(),
      (req, res) => {
        res.json({
          message: 'This is a protected route!',
          user: {
            id: req.user.userId,
            email: req.user.email,
            role: req.user.role,
            tenantId: req.tenantId
          }
        });
      }
    );
  }
  
  async start() {
    try {
      await this.init();
      const PORT = process.env.PORT || 3000;
      this.app.listen(PORT, () => {
        console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
        console.log('📚 API Endpoints:');
        console.log('   POST /api/auth/register - Register company');
        console.log('   POST /api/auth/login - Login user');
        console.log('   GET  /api/auth/profile - Get profile');
        console.log('   GET  /api/protected - Protected route');
      });
    } catch (error) {
      console.error('❌ Failed to start app:', error.message);
      process.exit(1);
    }
  }
}

new App().start();
`;

fs.writeFileSync('app.js', appContent);
console.log('✅ Created app.js');

// 4. Create database setup script
const dbSetupContent = `const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDatabase() {
  try {
    // Connect without database to create it
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });
    
    // Create database if not exists
    await connection.execute(\`CREATE DATABASE IF NOT EXISTS \${process.env.DB_NAME}\`);
    console.log(\`✅ Database '\${process.env.DB_NAME}' created/verified\`);
    
    await connection.end();
    
    console.log('🎉 Database setup complete!');
    console.log('Next steps:');
    console.log('1. npm install');
    console.log('2. Update .env with your database credentials');
    console.log('3. npm start');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('Please check your database credentials in .env file');
  }
}

createDatabase();
`;

fs.writeFileSync('setup-database.js', dbSetupContent);
console.log('✅ Created setup-database.js');

// 5. Create test script
const testContent = `const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testAuth() {
  try {
    console.log('🧪 Testing Universal Auth API...\n');
    
    // 1. Register company
    console.log('1. Registering company...');
    const registerRes = await axios.post(\`\${BASE_URL}/auth/register\`, {
      name: 'Test Company',
      adminEmail: 'admin@test.com',
      adminPassword: 'password123',
      adminFirstName: 'John',
      adminLastName: 'Doe'
    });
    console.log('✅ Company registered:', registerRes.data.data.tenantId);
    
    // 2. Login
    console.log('2. Logging in...');
    const loginRes = await axios.post(\`\${BASE_URL}/auth/login\`, {
      email: 'admin@test.com',
      password: 'password123'
    });
    const token = loginRes.data.data.token;
    console.log('✅ Login successful');
    
    // 3. Get profile
    console.log('3. Getting profile...');
    const profileRes = await axios.get(\`\${BASE_URL}/auth/profile\`, {
      headers: { Authorization: \`Bearer \${token}\` }
    });
    console.log('✅ Profile:', profileRes.data.data.email);
    
    // 4. Test protected route
    console.log('4. Testing protected route...');
    const protectedRes = await axios.get(\`\${BASE_URL}/protected\`, {
      headers: { Authorization: \`Bearer \${token}\` }
    });
    console.log('✅ Protected route:', protectedRes.data.message);
    
    console.log('\n🎉 All tests passed! Universal Auth is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run test if server is running
testAuth();
`;

fs.writeFileSync('test-auth.js', testContent);
console.log('✅ Created test-auth.js');

// 6. Create README
const readmeContent = `# My App with Universal Auth

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Setup database:**
   \`\`\`bash
   # Update .env with your database credentials
   node setup-database.js
   \`\`\`

3. **Start server:**
   \`\`\`bash
   npm start
   \`\`\`

4. **Test API:**
   \`\`\`bash
   # In another terminal
   node test-auth.js
   \`\`\`

## API Endpoints

- \`POST /api/auth/register\` - Register new company
- \`POST /api/auth/login\` - User login  
- \`GET /api/auth/profile\` - Get user profile
- \`GET /api/protected\` - Example protected route

## Environment Variables

Update \`.env\` file with your settings:

\`\`\`
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_app_db
JWT_SECRET=your-secret-key
\`\`\`

## Adding Your Routes

Add your application routes in \`app.js\`:

\`\`\`javascript
// Example: Products API
const products = express.Router();
products.use(this.authMiddleware.authenticate());

products.get('/', async (req, res) => {
  // Your logic here - req.tenantId and req.user available
});

this.app.use('/api/products', products);
\`\`\`

## Database Tables

Universal Auth creates these tables automatically:
- \`tenants\` - Company/organization data
- \`users\` - User accounts with multi-tenant support  
- \`temp_access_tokens\` - Temporary access tokens

Add \`tenant_id\` to your app tables for multi-tenant support.
`;

fs.writeFileSync('README.md', readmeContent);
console.log('✅ Created README.md');

console.log('\n🎉 Universal Auth setup complete!');
console.log('\nNext steps:');
console.log('1. npm install');
console.log('2. Update .env with your database credentials');
console.log('3. node setup-database.js');
console.log('4. npm start');
console.log('5. node test-auth.js (in another terminal)');
console.log('\n📖 Check README.md for detailed instructions');