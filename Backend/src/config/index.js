require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development'
  },
  
  database: {
    host: process.env.DB_HOST ,
    port: process.env.DB_PORT ,
    database: process.env.DB_NAME ,
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD ,
    connectionLimit: 20
  },
  
  redis: {
    host: process.env.REDIS_HOST ,
    port: process.env.REDIS_PORT ,
    password: process.env.REDIS_PASSWORD,
    db: 0
  },
  
  jwt: {
    secret: process.env.JWT_SECRET ,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  },
  
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute window
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000 // 100 requests per minute
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};