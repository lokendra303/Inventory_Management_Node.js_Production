const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./database/connection');
const logger = require('./utils/logger');
const routes = require('./routes');
const { extractTenantContext, createTenantRateLimit } = require('./middleware/auth');

class Server {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://*.yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      }
    });
    this.app.use('/api', limiter);

    // Tenant-specific rate limiting
    this.app.use('/api', createTenantRateLimit(15 * 60 * 1000, 1000)); // 1000 requests per 15 minutes per tenant

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('Request received', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Tenant context extraction (skip for public routes)
    this.app.use('/api', (req, res, next) => {
      if (req.path === '/auth/register-tenant' || req.path === '/auth/login' || req.path === '/health') {
        return next();
      }
      return extractTenantContext(req, res, next);
    });

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  setupRoutes() {
    // API routes
    this.app.use('/api', require('./routes/api'));

    // Serve static files in production
    if (config.server.env === 'production') {
      this.app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));
      
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
      });
    } else {
      this.app.get('/', (req, res) => {
        res.json({
          message: 'IMS SEPCUNE API Server',
          version: '1.0.0',
          environment: config.server.env,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      res.status(error.status || 500).json({
        success: false,
        error: config.server.env === 'production' 
          ? 'Internal server error' 
          : error.message
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.shutdown();
    });
  }

  async start() {
    try {
      // Connect to database
      await db.connect();
      logger.info('Database connected successfully');

      // Start server
      const server = this.app.listen(config.server.port, () => {
        logger.info(`Server started on port ${config.server.port} in ${config.server.env} mode`);
      });

      this.server = server;
      return server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    try {
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      await db.close();
      logger.info('Database connection closed');
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}

module.exports = Server;