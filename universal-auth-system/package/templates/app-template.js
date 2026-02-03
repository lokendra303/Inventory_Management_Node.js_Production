// example-new-app.js
// Complete example of using Universal Auth in a new application

const express = require('express');
const mysql = require('mysql2/promise');
const { UniversalAuth, AuthController, AuthMiddleware, migrations } = require('@yourcompany/universal-auth');

class NewApplication {
  constructor() {
    this.app = express();
    this.setupDatabase();
    this.setupAuth();
    this.setupRoutes();
  }

  async setupDatabase() {
    // Create database connection
    this.db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'new_app_db'
    });

    // Run auth migrations
    await migrations.runMigrations(this.db);
    console.log('✓ Database setup complete');
  }

  setupAuth() {
    // Initialize Universal Auth
    this.authService = new UniversalAuth({
      jwtSecret: process.env.JWT_SECRET || 'your-super-secret-key',
      jwtExpiresIn: '24h',
      database: this.db,
      logger: console,
      sessionTimeout: 15 * 60 * 1000 // 15 minutes
    });

    // Initialize controller and middleware
    this.authController = new AuthController(this.authService);
    this.authMiddleware = new AuthMiddleware(this.authService);
    
    console.log('✓ Auth service initialized');
  }

  setupRoutes() {
    this.app.use(express.json());

    // Public auth routes
    this.setupAuthRoutes();
    
    // Protected application routes
    this.setupAppRoutes();
    
    console.log('✓ Routes setup complete');
  }

  setupAuthRoutes() {
    const authRouter = express.Router();

    // Public routes - no authentication required
    authRouter.post('/register', this.authController.registerinstitution.bind(this.authController));
    authRouter.post('/login', this.authController.login.bind(this.authController));
    authRouter.post('/refresh-token', this.authController.refreshToken.bind(this.authController));

    // Protected routes - authentication required
    authRouter.use(this.authMiddleware.authenticate());
    authRouter.get('/profile', this.authController.getProfile.bind(this.authController));
    authRouter.post('/change-password', this.authController.changePassword.bind(this.authController));

    // Admin only routes
    authRouter.use(this.authMiddleware.requireRole('admin'));
    authRouter.post('/users', this.authController.createUser.bind(this.authController));
    authRouter.get('/users', this.authController.getUsers.bind(this.authController));
    authRouter.put('/users/:userId/permissions', this.authController.updateUserPermissions.bind(this.authController));

    this.app.use('/api/auth', authRouter);
  }

  setupAppRoutes() {
    // Example: Task Management Routes
    const taskRouter = express.Router();

    // All task routes require authentication
    taskRouter.use(this.authMiddleware.authenticate());

    // Get tasks (any authenticated user)
    taskRouter.get('/', async (req, res) => {
      try {
        const tasks = await this.db.query(
          'SELECT * FROM tasks WHERE institution_id = ? ORDER BY created_at DESC',
          [req.institutionId]
        );
        res.json({ success: true, data: tasks });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Create task (requires 'tasks' permission)
    taskRouter.post('/', 
      this.authMiddleware.requirePermission('tasks'),
      async (req, res) => {
        try {
          const { title, description, priority } = req.body;
          const taskId = require('uuid').v4();
          
          await this.db.query(
            'INSERT INTO tasks (id, institution_id, title, description, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [taskId, req.institutionId, title, description, priority, req.user.userId]
          );
          
          res.status(201).json({ 
            success: true, 
            message: 'Task created successfully',
            data: { taskId }
          });
        } catch (error) {
          res.status(400).json({ success: false, error: error.message });
        }
      }
    );

    // Delete task (admin only)
    taskRouter.delete('/:taskId',
      this.authMiddleware.requireRole('admin'),
      async (req, res) => {
        try {
          const result = await this.db.query(
            'DELETE FROM tasks WHERE id = ? AND institution_id = ?',
            [req.params.taskId, req.institutionId]
          );
          
          if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Task not found' });
          }
          
          res.json({ success: true, message: 'Task deleted successfully' });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    this.app.use('/api/tasks', taskRouter);

    // Example: Reports Routes (admin only)
    const reportsRouter = express.Router();
    reportsRouter.use(this.authMiddleware.authenticate());
    reportsRouter.use(this.authMiddleware.requireRole(['admin', 'manager']));

    reportsRouter.get('/dashboard', async (req, res) => {
      try {
        const stats = await this.db.query(`
          SELECT 
            COUNT(*) as total_tasks,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks
          FROM tasks 
          WHERE institution_id = ?
        `, [req.institutionId]);
        
        res.json({ success: true, data: stats[0] });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.use('/api/reports', reportsRouter);
  }

  async createTasksTable() {
    // Create application-specific tables
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        institution_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
        created_by VARCHAR(36) NOT NULL,
        assigned_to VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_task_institution (institution_id),
        INDEX idx_task_status (status),
        INDEX idx_task_priority (priority)
      )
    `);
    console.log('✓ Tasks table created');
  }

  async start() {
    await this.createTasksTable();
    
    const PORT = process.env.PORT || 3000;
    this.app.listen(PORT, () => {
      console.log(`🚀 New Application running on port ${PORT}`);
      console.log(`📚 API Documentation:`);
      console.log(`   POST /api/auth/register - Register new company`);
      console.log(`   POST /api/auth/login - User login`);
      console.log(`   GET  /api/auth/profile - Get user profile`);
      console.log(`   GET  /api/tasks - Get tasks`);
      console.log(`   POST /api/tasks - Create task`);
      console.log(`   GET  /api/reports/dashboard - Dashboard stats`);
    });
  }
}

// Usage
async function main() {
  try {
    const app = new NewApplication();
    await app.start();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Test the API
async function testAPI() {
  const axios = require('axios');
  const baseURL = 'http://localhost:3000/api';

  try {
    console.log('🧪 Testing API...');

    // 1. Register new institution
    console.log('1. Registering new institution...');
    const registerResponse = await axios.post(`${baseURL}/auth/register`, {
      name: 'Test Company',
      adminEmail: 'admin@test.com',
      adminPassword: 'password123',
      adminFirstName: 'John',
      adminLastName: 'Doe'
    });
    console.log('✓ institution registered:', registerResponse.data);

    // 2. Login
    console.log('2. Logging in...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@test.com',
      password: 'password123'
    });
    const token = loginResponse.data.data.token;
    console.log('✓ Login successful');

    // 3. Get profile
    console.log('3. Getting profile...');
    const profileResponse = await axios.get(`${baseURL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✓ Profile retrieved:', profileResponse.data.data.email);

    // 4. Create task
    console.log('4. Creating task...');
    const taskResponse = await axios.post(`${baseURL}/tasks`, {
      title: 'Test Task',
      description: 'This is a test task',
      priority: 'high'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✓ Task created:', taskResponse.data);

    // 5. Get tasks
    console.log('5. Getting tasks...');
    const tasksResponse = await axios.get(`${baseURL}/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✓ Tasks retrieved:', tasksResponse.data.data.length, 'tasks');

    console.log('🎉 All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

if (require.main === module) {
  main();
  
  // Run tests after 2 seconds
  setTimeout(testAPI, 2000);
}

module.exports = NewApplication;