const authService = require('../services/authService');
const logger = require('../utils/logger');

class AuthController {
  async registerUser(req, res) {
    try {
      const { email, password, firstName, lastName, companyName } = req.body;
      
      // Generate tenant ID
      const tenantId = require('uuid').v4();
      
      // Create tenant first
      await require('../database/connection').query(
        'INSERT INTO tenants (id, name, status) VALUES (?, ?, "active")',
        [tenantId, companyName]
      );
      
      // Create admin user for the new tenant
      const userId = await authService.createUser(tenantId, {
        email,
        password,
        firstName,
        lastName,
        role: 'admin'
      });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully with new company',
        data: { 
          userId, 
          tenantId,
          companyName
        }
      });
    } catch (error) {
      logger.error('User registration failed', { error: error.message, body: req.body });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async registerTenant(req, res) {
    try {
      const { tenantId, userId } = await authService.createTenant(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Tenant created successfully',
        data: { tenantId, userId }
      });
    } catch (error) {
      logger.error('Tenant registration failed', { error: error.message, body: req.body });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await authService.authenticateUser(email, password);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message, email: req.body.email });
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async createUser(req, res) {
    try {
      const userId = await authService.createUser(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { userId }
      });
    } catch (error) {
      logger.error('User creation failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        createdBy: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getUsers(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      const users = await authService.getTenantUsers(req.tenantId, limit, offset);
      
      res.json({
        success: true,
        data: users,
        pagination: { limit, offset, total: users.length }
      });
    } catch (error) {
      logger.error('Failed to get users', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const { permissions, warehouseAccess, role } = req.body;
      
      logger.info('=== UPDATE USER PERMISSIONS REQUEST ===', {
        userId,
        role,
        permissions,
        warehouseAccess,
        tenantId: req.tenantId,
        requestBody: req.body,
        params: req.params
      });
      
      // Validate user exists first
      const users = await authService.getTenantUsers(req.tenantId);
      const existingUser = users.find(u => u.id === userId);
      
      if (!existingUser) {
        logger.error('User not found for permissions update', { userId, tenantId: req.tenantId });
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      logger.info('Found existing user', {
        existingUser: {
          id: existingUser.id,
          email: existingUser.email,
          currentRole: existingUser.role,
          currentPermissions: existingUser.permissions
        }
      });
      
      await authService.updateUserPermissions(req.tenantId, userId, permissions, warehouseAccess, role);
      
      logger.info('=== PERMISSIONS UPDATE COMPLETED ===', {
        userId,
        tenantId: req.tenantId
      });
      
      res.json({
        success: true,
        message: 'User permissions updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user permissions', { 
        error: error.message,
        stack: error.stack,
        tenantId: req.tenantId,
        userId: req.params.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status } = req.body;
      
      logger.info('Update user status request', {
        userId,
        status,
        tenantId: req.tenantId,
        requestingUser: req.user?.userId
      });
      
      if (!req.tenantId) {
        logger.error('Missing tenant context in updateUserStatus');
        return res.status(400).json({
          success: false,
          error: 'Tenant context required'
        });
      }
      
      await authService.updateUserStatus(req.tenantId, userId, status);
      
      res.json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user status', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.params.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getProfile(req, res) {
    try {
      // Get full user details from database
      const users = await authService.getTenantUsers(req.tenantId);
      const userProfile = users.find(u => u.id === req.user.userId);
      
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
          userId: req.user.userId,
          tenantId: req.user.tenantId,
          email: userProfile.email,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          role: userProfile.role,
          permissions: typeof userProfile.permissions === 'string' ? JSON.parse(userProfile.permissions || '{}') : userProfile.permissions || {}
        }
      });
    } catch (error) {
      logger.error('Failed to get profile', { error: error.message, userId: req.user.userId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

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
      const result = await authService.refreshToken(token);
      
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const { firstName, lastName, email } = req.body;
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      await authService.updateUserProfile(tenantId, userId, {
        firstName,
        lastName,
        email
      });

      // Fetch updated profile
      const updatedUser = await authService.getTenantUsers(tenantId);
      const userProfile = updatedUser.find(u => u.id === userId);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: userProfile.id,
          email: userProfile.email,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          role: userProfile.role
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
      const tenantId = req.tenantId;

      await authService.changePassword(tenantId, userId, currentPassword, newPassword);

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

  async generateTempAccess(req, res) {
    try {
      const { targetUserId, expiresInHours = 24 } = req.body;
      const { userId: paramUserId } = req.params;
      const adminUserId = req.user.userId;
      const tenantId = req.tenantId;

      // Use targetUserId from body, or fall back to URL param
      const finalTargetUserId = targetUserId || paramUserId;

      const result = await authService.generateTempAccess(tenantId, finalTargetUserId, adminUserId, expiresInHours);

      res.json({
        success: true,
        message: 'Temporary access generated successfully',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async tempLogin(req, res) {
    try {
      const { email, tempPassword, tenantId } = req.body;
      const result = await authService.loginWithTempAccess(email, tempPassword, tenantId);
      
      res.json({
        success: true,
        message: 'Temporary login successful',
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async extendSession(req, res) {
    try {
      const result = await authService.extendSession(req.user.userId, req.tenantId);
      
      res.json({
        success: true,
        message: 'Session extended successfully',
        data: result
      });
    } catch (error) {
      logger.error('Session extension failed', { error: error.message, userId: req.user.userId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();