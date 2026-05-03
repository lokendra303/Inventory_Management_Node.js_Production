const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./database/connection');
const logger = require('./utils/logger');
const { extractInstitutionContext } = require('./middleware/auth');
const auditMiddleware = require('./middleware/auditMiddleware');

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
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    }));

    // CORS — CORS_ORIGINS (comma-separated) or FRONTEND_URL; dev allows LAN regexes
    this.app.use(cors({
      origin: config.cors.origins,
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

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static uploads (BEFORE authentication)
    // Support both current and legacy upload locations.
    this.app.use(
      '/uploads',
      express.static(path.join(__dirname, '..', 'uploads')),
      express.static(path.join(__dirname, 'uploads'))
    );

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

    // Institution context extraction (skip auth, health, barcode, platform admin API)
    this.app.use('/api', (req, res, next) => {
      if (
        req.path.startsWith('/auth')
        || req.path === '/health'
        || req.path.startsWith('/barcode')
        || req.path.startsWith('/platform')
      ) {
        return next();
      }
      return extractInstitutionContext(req, res, next);
    });
    
    // Comprehensive audit logging middleware (after authentication)
    this.app.use('/api', auditMiddleware({
      skipRoutes: ['/health', '/auth/verify', '/auth/refresh', '/platform']
    }));
    
    // v2.1 - OTP auth routes are public

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  setupRoutes() {
    // Barcode scan session routes (public — mobile scanner needs no auth)
    this.app.use('/api/barcode', require('./routes/barcode'));

    // Auth routes (public — no token required)
    this.app.use('/api/auth', require('./modules/auth/auth.routes'));

    // Platform super-admin (separate JWT; no institution context)
    this.app.use('/api/platform', require('./modules/platform/platform.routes'));

    // API routes (protected)
    this.app.use('/api', require('./routes/api'));

    this.app.get(/^\/(?!api\/).*/, (req, res) => {
      res.status(200).json({
        message: 'IMS SEPCUNE API Server',
        version: '1.0.0',
        info: 'Use /api/* endpoints for backend requests',
        environment: config.server.env,
      });
    });
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
      const server = this.app.listen(config.server.port, config.server.host, () => {
        logger.info(`Server started on ${config.server.host}:${config.server.port} in ${config.server.env} mode`);
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