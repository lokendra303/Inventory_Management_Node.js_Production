const config = require('../../config');
const logger = require('../../utils/logger');

function errorMiddleware(err, req, res, next) {
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    institutionId: req.institutionId,
    userId: req.user?.userId,
  });

  const status = Number(err.status) || 500;
  const message =
    status === 500 && config.server.env === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(status).json({
    success: false,
    error: message,
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = errorMiddleware;
