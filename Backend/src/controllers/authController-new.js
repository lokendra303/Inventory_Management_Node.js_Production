const authService = require('../services/authService-new');
const logger = require('../utils/logger');

class AuthController {
  // Register new institution (replaces registerUser/registerinstitution)
  async registerInstitution(req, res) {
    try {
      const { 
        // Institution details
        institutionName, institutionEmail, institutionMobile, institutionAddress,
        institutionCity, institutionState, institutionCountry, institutionPostalCode,
        institutionType, registrationNumber, taxId, website, contactPerson,
        // Admin user details
        adminEmail, adminMobile, adminPassword, adminFirstName, adminLastName,
        adminAddress, adminCity, adminState, adminCountry, adminPostalCode,
        adminDateOfBirth, adminGender, adminDepartment, adminDesignation
      } = req.body;
      
      const { institutionId, userId } = await authService.createInstitution({
        name: institutionName,
        email: institutionEmail,
        mobile: institutionMobile,
        address: institutionAddress,
        city: institutionCity,
        state: institutionState,
        country: institutionCountry,
        postalCode: institutionPostalCode,
        institutionType,
        registrationNumber,
        taxId,
        website,
        contactPerson,
        adminEmail,
        adminMobile,
        adminPassword,
        adminFirstName,
        adminLastName,
        adminAddress,
        adminCity,
        adminState,
        adminCountry,
        adminPostalCode,
        adminDateOfBirth,
        adminGender,
        adminDepartment,
        adminDesignation
      });
      
      res.status(201).json({
        success: true,
        message: 'Institution registered successfully',
        data: { 
          institutionId, 
          userId,
          institutionName
        }
      });
    } catch (error) {
      logger.error('Institution registration failed', { error: error.message, body: req.body });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Backward compatibility - redirect to registerInstitution
  async registerUser(req, res) {
    const { email, password, firstName, lastName, companyName } = req.body;
    
    // Transform old format to new format
    req.body = {
      institutionName: companyName,
      institutionEmail: `admin@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      adminEmail: email,
      adminPassword: password,
      adminFirstName: firstName,
      adminLastName: lastName
    };
    
    return this.registerInstitution(req, res);
  }

  async registerinstitution(req, res) {
    return this.registerInstitution(req, res);
  }

  async login(req, res) {
    try {
      const { email, password, institutionId } = req.body;
      const result = await authService.authenticateUser(email, password, institutionId);
      
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
        req.institutionId || req.institutionId, // Support both for backward compatibility
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
        institutionId: req.institutionId || req.institutionId,
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
      
      const users = await authService.getInstitutionUsers(
        req.institutionId || req.institutionId, // Support both for backward compatibility
        limit, 
        offset
      );
      
      res.json({
        success: true,
        data: users,
        pagination: { limit, offset, total: users.length }
      });
    } catch (error) {
      logger.error('Failed to get users', { 
        error: error.message, 
        institutionId: req.institutionId || req.institutionId 
      });
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
      const institutionId = req.institutionId || req.institutionId;
      
      logger.info('=== UPDATE USER PERMISSIONS REQUEST ===', {
        userId,
        role,
        permissions,
        warehouseAccess,
        institutionId,
        requestBody: req.body,
        params: req.params
      });
      
      // Validate user exists first
      const users = await authService.getInstitutionUsers(institutionId);
      const existingUser = users.find(u => u.id === userId);
      
      if (!existingUser) {
        logger.error('User not found for permissions update', { userId, institutionId });
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
      
      await authService.updateUserPermissions(institutionId, userId, permissions, warehouseAccess, role);
      
      logger.info('=== PERMISSIONS UPDATE COMPLETED ===', {
        userId,
        institutionId
      });
      
      res.json({
        success: true,
        message: 'User permissions updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user permissions', { 
        error: error.message,
        stack: error.stack,
        institutionId: req.institutionId || req.institutionId,
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
      const institutionId = req.institutionId || req.institutionId;
      
      logger.info('Update user status request', {
        userId,
        status,
        institutionId,
        requestingUser: req.user?.userId
      });
      
      if (!institutionId) {
        logger.error('Missing institution context in updateUserStatus');
        return res.status(400).json({
          success: false,
          error: 'Institution context required'
        });
      }
      
      await authService.updateUserStatus(institutionId, userId, status);
      
      res.json({
        success: true,
        message: 'User status updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update user status', { 
        error: error.message, 
        institutionId: req.institutionId || req.institutionId,
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
      const institutionId = req.institutionId || req.institutionId;
      
      // Get full user details from database
      const users = await authService.getInstitutionUsers(institutionId);
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
          institutionId: req.user.institutionId || req.user.institutionId,
          email: userProfile.email,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          role: userProfile.role,
          department: userProfile.department,
          designation: userProfile.designation,
          employeeId: userProfile.employee_id,
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
      const institutionId = req.institutionId || req.institutionId;

      await authService.updateUserProfile(institutionId, userId, {
        firstName,
        lastName,
        email
      });

      // Fetch updated profile
      const updatedUsers = await authService.getInstitutionUsers(institutionId);
      const userProfile = updatedUsers.find(u => u.id === userId);

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
      const institutionId = req.institutionId || req.institutionId;

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

  async extendSession(req, res) {
    try {
      const result = await authService.extendSession(
        req.user.userId, 
        req.institutionId || req.institutionId
      );
      
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

  // Institution management endpoints
  async getInstitutionInfo(req, res) {
    try {
      const institutionId = req.institutionId || req.institutionId;
      const institution = await authService.getInstitutionByEmail(req.user.email);
      
      if (!institution) {
        return res.status(404).json({
          success: false,
          error: 'Institution not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: institution.id,
          name: institution.name,
          email: institution.email,
          mobile: institution.mobile,
          address: institution.address,
          city: institution.city,
          state: institution.state,
          country: institution.country,
          institutionType: institution.institution_type,
          registrationNumber: institution.registration_number,
          taxId: institution.tax_id,
          website: institution.website,
          contactPerson: institution.contact_person,
          status: institution.status,
          plan: institution.plan
        }
      });
    } catch (error) {
      logger.error('Failed to get institution info', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateInstitutionSettings(req, res) {
    try {
      const institutionId = req.institutionId || req.institutionId;
      const { settings } = req.body;

      await authService.updateInstitutionSettings(institutionId, settings);

      res.json({
        success: true,
        message: 'Institution settings updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update institution settings', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();