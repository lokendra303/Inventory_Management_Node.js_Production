/**
 * Ensures /uploads/* is proxied to the API in dev (stamps, signatures, documents).
 * package.json "proxy" can miss some static GETs; this route is explicit.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.REACT_APP_PROXY_TARGET || 'http://localhost:5000';
  app.use(
    '/uploads',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
