function notFoundMiddleware(req, res) {
  return res.status(404).json({
    success: false,
    error: 'Route not found',
  });
}

module.exports = notFoundMiddleware;
