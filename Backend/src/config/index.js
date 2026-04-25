require('dotenv').config();

const ENV_PROFILE = (process.env.ENV_PROFILE || '').trim().toUpperCase();

function getEnvByProfile(baseKey) {
  if (ENV_PROFILE) {
    const profileValue = process.env[`${baseKey}_${ENV_PROFILE}`];
    if (profileValue && profileValue.trim()) return profileValue;
  }
  return process.env[baseKey];
}

function buildCorsOrigins() {
  const fromEnv = getEnvByProfile('CORS_ORIGINS');
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const frontendUrl = (getEnvByProfile('FRONTEND_URL') || '').replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    return frontendUrl ? [frontendUrl] : [];
  }
  const fe = frontendUrl || 'http://localhost:3000';
  return [
    fe,
    'http://localhost:3001',
    /^http:\/\/192\.168\./,
    /^http:\/\/172\./,
    /^http:\/\/10\./,
  ];
}

/** Base URL for absolute links to this server (uploads, server-side PDF image fetch). No trailing slash. */
function resolvePublicBaseUrl() {
  const fromEnv = (getEnvByProfile('PUBLIC_BASE_URL') || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const port = process.env.PORT || 5000;
  return `http://127.0.0.1:${port}`;
}

module.exports = {
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development'
  },

  cors: {
    origins: buildCorsOrigins(),
  },

  resolvePublicBaseUrl,
  
  database: {
    host: process.env.DB_HOST ,
    port: process.env.DB_PORT ,
    database: process.env.DB_NAME ,
    user: process.env.DB_USER ,
    password: process.env.DB_PASSWORD ,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 20,
    charset: 'utf8mb4_unicode_ci'
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
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
  },

  razorpay: {
    keyId:     process.env.RAZORPAY_KEY_ID     || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  /** Platform (super-admin) console — separate from tenant JWT expiry */
  platform: {
    jwtExpiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '8h',
    bootstrapEmail: process.env.PLATFORM_ADMIN_EMAIL || '',
    bootstrapPassword: process.env.PLATFORM_ADMIN_PASSWORD || '',
    bootstrapName: process.env.PLATFORM_ADMIN_NAME || 'Platform Admin',
  },
};