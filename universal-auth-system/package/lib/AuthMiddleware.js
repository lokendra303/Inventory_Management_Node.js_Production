class UniversalAuthMiddleware {
  constructor(authService) {
    this.authService = authService;
  }

  // Verify JWT token middleware
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Access token required'
          });
        }

        const token = authHeader.substring(7);
        const decoded = await this.authService.verifyToken(token);
        
        req.user = decoded;
        req.tenantId = decoded.tenantId;
        
        next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: error.message
        });
      }
    };
  }

  // Check if user has specific permission
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userPermissions = req.user.permissions || {};
      
      // Admin has all permissions
      if (req.user.role === 'admin' || userPermissions.all === true) {
        return next();
      }

      // Check specific permission
      if (!userPermissions[permission]) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  // Check if user has specific role
  requireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient role permissions'
        });
      }

      next();
    };
  }

  // Optional authentication (doesn't fail if no token)
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const decoded = await this.authService.verifyToken(token);
          
          req.user = decoded;
          req.tenantId = decoded.tenantId;
        }
        
        next();
      } catch (error) {
        // Continue without authentication
        next();
      }
    };
  }

  // Tenant isolation middleware
  requireTenant() {
    return (req, res, next) => {
      if (!req.tenantId && !req.body.tenantId && !req.query.tenantId) {
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }

      // Set tenantId from various sources
      req.tenantId = req.tenantId || req.body.tenantId || req.query.tenantId;
      
      next();
    };
  }
}

module.exports = UniversalAuthMiddleware;