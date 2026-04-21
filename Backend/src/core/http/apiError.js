class ApiError extends Error {
  constructor(status = 500, message = 'Internal server error', details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }
}

module.exports = ApiError;
