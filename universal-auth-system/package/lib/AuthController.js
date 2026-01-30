class UniversalAuthController {
  constructor(authService) {
    this.authService = authService;
  }

  // Register new institution with admin user
  async registerinstitution(req, res) {
    try {
      const { institutionId, userId } = await this.authService.createinstitution(req.body);
      
      res.status(201).json({
        success: true,
        message: 'institution created successfully',
        data: { institutionId, userId }
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
      const { email, password, institutionId } = req.body;
      const result = await this.authService.authenticateUser(email, password, institutionId);
      
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
        req.institutionId || req.body.institutionId,
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
      const institutionId = req.institutionId || req.query.institutionId;
      
      const users = await this.authService.getinstitutionUsers(institutionId, limit, offset);
      
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
      const institutionId = req.institutionId || req.body.institutionId;
      
      await this.authService.updateUserPermissions(institutionId, userId, permissions, warehouseAccess, role);
      
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
      const institutionId = req.institutionId || req.user.institutionId;
      const userId = req.user.userId;
      
      const users = await this.authService.getinstitutionUsers(institutionId);
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
          institutionId: institutionId,
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
      const institutionId = req.institutionId || req.user.institutionId;

      await this.authService.changePassword(institutionId, userId, currentPassword, newPassword);

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