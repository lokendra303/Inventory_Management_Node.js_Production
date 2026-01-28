const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Optional auth import - app works without it
let OptionalAuth;
try {
  const { OptionalAuth: Auth } = require('./universal-auth-package');
  OptionalAuth = Auth;
} catch (error) {
  console.log('⚠️ Universal Auth not found - running without authentication');
  OptionalAuth = null;
}

class IndependentApp {
  async init() {
    this.app = express();
    this.app.use(express.json());
    
    // Database connection
    this.db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'app_db'
    });
    
    console.log('✅ Database connected');
    
    // Optional auth setup
    this.setupAuth();
    
    // App routes
    this.setupRoutes();
  }
  
  async setupAuth() {
    const authEnabled = process.env.AUTH_ENABLED !== 'false' && OptionalAuth;
    
    if (authEnabled) {
      this.auth = new OptionalAuth({
        enabled: true,
        jwtSecret: process.env.JWT_SECRET || 'default-secret',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        database: this.db
      });
      
      // Run auth migrations
      await this.auth.runMigrations(this.db);
      console.log('✅ Auth enabled and configured');
    } else {
      this.auth = new (class {
        authenticate() { return (req, res, next) => next(); }
        requireRole() { return (req, res, next) => next(); }
        requirePermission() { return (req, res, next) => next(); }
        getAuthRoutes() { 
          const router = express.Router();
          router.all('*', (req, res) => res.json({ message: 'Auth disabled' }));
          return router;
        }
      })();
      console.log('⚠️ Auth disabled - app running without authentication');
    }
  }
  
  setupRoutes() {
    // Health check
    this.app.get('/', (req, res) => {
      res.json({ 
        message: 'Independent App Running!',
        authEnabled: !!this.auth.enabled,
        endpoints: {
          'GET /api/products': 'Get products',
          'POST /api/products': 'Create product',
          'GET /api/orders': 'Get orders',
          'POST /api/auth/*': 'Auth endpoints (if enabled)'
        }
      });
    });
    
    // Auth routes (optional)
    this.app.use('/api/auth', this.auth.getAuthRoutes());
    
    // Products API
    const products = express.Router();
    
    // Optional authentication
    products.use(this.auth.authenticate());
    
    products.get('/', async (req, res) => {
      try {
        const tenantFilter = req.tenantId ? 'WHERE tenant_id = ?' : '';
        const params = req.tenantId ? [req.tenantId] : [];
        
        const results = await this.db.query(
          \`SELECT * FROM products \${tenantFilter} ORDER BY created_at DESC\`,
          params
        );
        
        res.json({ 
          success: true, 
          data: results,
          user: req.user ? req.user.email : 'anonymous'
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    products.post('/', this.auth.requirePermission('products'), async (req, res) => {
      try {
        const { name, price, description } = req.body;
        const id = require('uuid').v4();
        const tenantId = req.tenantId || 'default';
        const createdBy = req.user?.userId || 'system';
        
        await this.db.query(
          'INSERT INTO products (id, tenant_id, name, price, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [id, tenantId, name, price, description, createdBy]
        );
        
        res.status(201).json({ 
          success: true, 
          message: 'Product created',
          data: { id }
        });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    });
    
    this.app.use('/api/products', products);
    
    // Orders API
    const orders = express.Router();
    orders.use(this.auth.authenticate());
    
    orders.get('/', async (req, res) => {
      try {
        const tenantFilter = req.tenantId ? 'WHERE tenant_id = ?' : '';
        const params = req.tenantId ? [req.tenantId] : [];
        
        const results = await this.db.query(
          \`SELECT * FROM orders \${tenantFilter} ORDER BY created_at DESC\`,
          params
        );
        
        res.json({ success: true, data: results });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    this.app.use('/api/orders', orders);
  }
  
  async createAppTables() {
    // Create app tables (works with or without auth)
    await this.db.query(\`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) DEFAULT 'default',
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2),
        description TEXT,
        created_by VARCHAR(36) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product_tenant (tenant_id)
      )
    \`);
    
    await this.db.query(\`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) DEFAULT 'default',
        customer_name VARCHAR(255),
        total DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        created_by VARCHAR(36) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order_tenant (tenant_id)
      )
    \`);
    
    console.log('✅ App tables created');
  }
  
  async start() {
    try {
      await this.init();
      await this.createAppTables();
      
      const PORT = process.env.PORT || 3000;
      this.app.listen(PORT, () => {
        console.log(\`🚀 Independent App running on http://localhost:\${PORT}\`);
        console.log('📚 API Endpoints:');
        console.log('   GET  /api/products - Get products');
        console.log('   POST /api/products - Create product');
        console.log('   GET  /api/orders - Get orders');
        if (this.auth.enabled) {
          console.log('   POST /api/auth/register - Register (auth enabled)');
          console.log('   POST /api/auth/login - Login (auth enabled)');
        } else {
          console.log('   ⚠️  Auth endpoints disabled');
        }
      });
    } catch (error) {
      console.error('❌ Failed to start app:', error.message);
      process.exit(1);
    }
  }
}

new IndependentApp().start();