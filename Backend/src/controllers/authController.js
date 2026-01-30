const authService = require('../services/authService');
const logger = require('../utils/logger');

class AuthController {
  async registerUser(req, res) {
    try {
      const { email, password, firstName, lastName, companyName } = req.body;
      
      // Generate institution ID
      const institutionId = require('uuid').v4();
      
      // Create institution first
      await require('../database/connection').query(
        'INSERT INTO institutions (id, name, status) VALUES (?, ?, "active")',
        [institutionId, companyName]
      );
      
      // Create admin user for the new institution
      const userId = await authService.createUser(institutionId, {
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
          institutionId,
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

  async registerinstitution(req, res) {
    return this.registerInstitution(req, res);
  }

  async registerInstitution(req, res) {
    try {
      const { institutionId, userId } = await authService.createInstitution(req.body);
      
      res.status(201).json({
        success: true,
        message: 'Institution created successfully',
        data: { institutionId, userId }
      });
    } catch (error) {
      logger.error('Institution registration failed', { error: error.message, body: req.body });
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
        req.institutionId,
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
        institutionId: req.institutionId,
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
      
      const institution_users = await authService.getInstitutionUsers(req.institutionId, limit, offset);
      
      res.json({
        success: true,
        data: institution_users,
        pagination: { limit, offset, total: institution_users.length }
      });
    } catch (error) {
      logger.error('Failed to get institution_users', { error: error.message, institutionId: req.institutionId });
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
        institutionId: req.institutionId,
        requestBody: req.body,
        params: req.params
      });
      
      // Validate user exists first
      const institution_users = await authService.getInstitutionUsers(req.institutionId);
      const existingUser = institution_users.find(u => u.id === userId);
      
      if (!existingUser) {
        logger.error('User not found for permissions update', { userId, institutionId: req.institutionId });
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
      
      await authService.updateUserPermissions(req.institutionId, userId, permissions, warehouseAccess, role);
      
      logger.info('=== PERMISSIONS UPDATE COMPLETED ===', {
        userId,
        institutionId: req.institutionId
      });
      
      res.json({
        success: true,
        message: 'User permissions updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user permissions', { 
        error: error.message,
        stack: error.stack,
        institutionId: req.institutionId,
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
        institutionId: req.institutionId,
        requestingUser: req.user?.userId
      });
      
      if (!req.institutionId) {
        logger.error('Missing institution context in updateUserStatus');
        return res.status(400).json({
          success: false,
          error: 'Institution context required'
        });
      }
      
      await authService.updateUserStatus(req.institutionId, userId, status);
      
      res.json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user status', { 
        error: error.message, 
        institutionId: req.institutionId,
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
      const institution_users = await authService.getInstitutionUsers(req.institutionId);
      const userProfile = institution_users.find(u => u.id === req.user.userId);
      
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
          institutionId: req.user.institutionId,
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
      const institutionId = req.institutionId;

      await authService.updateUserProfile(institutionId, userId, {
        firstName,
        lastName,
        email
      });

      // Fetch updated profile
      const updatedUser = await authService.getInstitutionUsers(institutionId);
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
      const institutionId = req.institutionId;

      await authService.changePassword(institutionId, userId, currentPassword, newPassword);

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
      const institutionId = req.institutionId;

      // Use targetUserId from body, or fall back to URL param
      const finalTargetUserId = targetUserId || paramUserId;

      const result = await authService.generateTempAccess(institutionId, finalTargetUserId, adminUserId, expiresInHours);

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
      const { email, tempPassword, institutionId } = req.body;
      const result = await authService.loginWithTempAccess(email, tempPassword, institutionId);
      
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
      const result = await authService.extendSession(req.user.userId, req.institutionId);
      
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