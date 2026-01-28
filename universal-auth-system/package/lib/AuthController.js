class UniversalAuthController {
  constructor(authService) {
    this.authService = authService;
  }

  // Register new tenant with admin user
  async registerTenant(req, res) {
    try {
      const { tenantId, userId } = await this.authService.createTenant(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Tenant created successfully',
        data: { tenantId, userId }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // User login
  async login(req, res) {
    try {
      const { email, password, tenantId } = req.body;
      const result = await this.authService.authenticateUser(email, password, tenantId);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // Create new user
  async createUser(req, res) {
    try {
      const userId = await this.authService.createUser(
        req.tenantId || req.body.tenantId,
        req.body
      );
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { userId }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get users
  async getUsers(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const tenantId = req.tenantId || req.query.tenantId;
      
      const users = await this.authService.getTenantUsers(tenantId, limit, offset);
      
      res.json({
        success: true,
        data: users,
        pagination: { limit, offset, total: users.length }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Update user permissions
  async updateUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const { permissions, warehouseAccess, role } = req.body;
      const tenantId = req.tenantId || req.body.tenantId;
      
      await this.authService.updateUserPermissions(tenantId, userId, permissions, warehouseAccess, role);
      
      res.json({
        success: true,
        message: 'User permissions updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get user profile
  async getProfile(req, res) {
    try {
      const tenantId = req.tenantId || req.user.tenantId;
      const userId = req.user.userId;
      
      const users = await this.authService.getTenantUsers(tenantId);
      const userProfile = users.find(u => u.id === userId);
      
      if (!userProfile) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: userProfile.id,
          userId: userId,
          tenantId: tenantId,
          email: userProfile.email,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          role: userProfile.role,
          permissions: typeof userProfile.permissions === 'string' ? JSON.parse(userProfile.permissions || '{}') : userProfile.permissions || {}
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Token required for refresh'
        });
      }

      const token = authHeader.substring(7);
      const result = await this.authService.refreshToken(token);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
      const tenantId = req.tenantId || req.user.tenantId;

      await this.authService.changePassword(tenantId, userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = UniversalAuthController;