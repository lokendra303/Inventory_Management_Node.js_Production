const UniversalAuth = require('./lib/UniversalAuth');
const AuthController = require('./lib/AuthController');
const AuthMiddleware = require('./lib/AuthMiddleware');
const migrations = require('./lib/migrations');

class OptionalAuth {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.config = config;
    
    if (this.enabled) {
      this.auth = new UniversalAuth(config);
      this.controller = new AuthController(this.auth);
      this.middleware = new AuthMiddleware(this.auth);
    }
  }

  // Optional middleware - passes through if auth disabled
  authenticate() {
    if (!this.enabled) {
      return (req, res, next) => next();
    }
    return this.middleware.authenticate();
  }

  requireRole(roles) {
    if (!this.enabled) {
      return (req, res, next) => next();
    }
    return this.middleware.requireRole(roles);
  }

  requirePermission(permission) {
    if (!this.enabled) {
      return (req, res, next) => next();
    }
    return this.middleware.requirePermission(permission);
  }

  // Optional routes - returns empty router if disabled
  getAuthRoutes() {
    if (!this.enabled) {
      const express = require('express');
      const router = express.Router();
      router.all('*', (req, res) => res.status(404).json({ error: 'Auth not enabled' }));
      return router;
    }

    const express = require('express');
    const router = express.Router();
    
    router.post('/register', this.controller.registerTenant.bind(this.controller));
    router.post('/login', this.controller.login.bind(this.controller));
    router.post('/refresh', this.controller.refreshToken.bind(this.controller));
    
    router.use(this.middleware.authenticate());
    router.get('/profile', this.controller.getProfile.bind(this.controller));
    router.post('/change-password', this.controller.changePassword.bind(this.controller));
    
    router.use(this.middleware.requireRole('admin'));
    router.post('/users', this.controller.createUser.bind(this.controller));
    router.get('/users', this.controller.getUsers.bind(this.controller));
    
    return router;
  }

  async runMigrations(database) {
    if (!this.enabled) {
      console.log('⚠️ Auth disabled - skipping migrations');
      return;
    }
    return migrations.runMigrations(database);
  }
}

module.exports = {
  UniversalAuth,
  AuthController,
  AuthMiddleware,
  OptionalAuth,
  migrations
};