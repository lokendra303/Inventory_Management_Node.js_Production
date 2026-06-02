const authService = require('./auth.service');
const logger = require('../../utils/logger');

class AuthController {
  async sendOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: 'email is required.' });
      await authService.sendRegistrationOtp(email);
      res.json({ success: true, message: 'OTP sent to your email address.' });
    } catch (error) {
      logger.error('Send registration OTP failed', { error: error.message, email: req.body.email });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyRegistrationOtp(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ success: false, error: 'email and otp are required.' });
      await authService.verifyRegistrationOtp(email, otp);
      res.json({ success: true, message: 'OTP verified successfully.' });
    } catch (error) {
      logger.error('Registration OTP verification failed', { error: error.message, email: req.body.email });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // Register new institution (replaces registerUser/registerinstitution)
  async registerInstitution(req, res) {
    try {
      const { 
        // Institution details
        name, institutionEmail, institutionMobile, institutionAddress,
        institutionCity, institutionState, institutionCountry, institutionPostalCode,
        institutionType, registrationNumber, taxId, website, contactPerson,
        // Institution owner details (super admin)
        adminEmail, adminMobile, adminPassword, adminFirstName, adminLastName,
        adminAddress, adminCity, adminState, adminCountry, adminPostalCode,
        adminDateOfBirth, adminGender, adminDepartment, adminDesignation
      } = req.body;
      
      const { institutionId, userId } = await authService.createInstitution({
        name: name,
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
          institutionName: name,
          needsAdditionalInfo: true
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
      const loginResult = await authService.initiateLogin(email, password, institutionId);

      if (!loginResult.requiresOtp && loginResult.tokenData) {
        return res.json({
          success: true,
          message: 'Login successful',
          data: {
            requiresOtp: false,
            ...loginResult.tokenData
          }
        });
      }

      res.json({
        success: true,
        message: 'OTP sent to your registered email address.',
        data: { requiresOtp: true, email: loginResult.email, institutionId: loginResult.institutionId }
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message, email: req.body.email });
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async verifyOtp(req, res) {
    try {
      const { email, otp, institutionId } = req.body;
      if (!email || !otp || !institutionId) {
        return res.status(400).json({ success: false, error: 'email, otp, and institutionId are required.' });
      }
      const result = await authService.verifyOtp(email, otp, institutionId);
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      logger.error('OTP verification failed', { error: error.message, email: req.body.email });
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
      
      const users = await authService.getInstitutionUsers(req.institutionId, limit, offset);
      
      res.json({
        success: true,
        data: users,
        pagination: { limit, offset, total: users.length }
      });
    } catch (error) {
      logger.error('Failed to get users', { error: error.message, institutionId: req.institutionId });
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
      const users = await authService.getInstitutionUsers(req.institutionId);
      const existingUser = users.find(u => u.id === userId);
      
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
      const db = require('../../database/connection');
      const rows = await db.query(
        `SELECT u.*, i.name as institution_name FROM institution_users u
         JOIN institutions i ON u.institution_id = i.id
         WHERE u.id = ? AND u.institution_id = ? LIMIT 1`,
        [req.user.userId, req.institutionId]
      );
      const userProfile = rows[0];

      if (!userProfile) {
        return res.status(404).json({
          success: false,
          error: 'User profile not found'
        });
      }

      const parsePermissions = (raw) => {
        if (!raw) return {};
        if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          } catch (_) {
            return {};
          }
        }
        return {};
      };

      // Keep profile permissions aligned with auth token permission resolution.
      let effectivePermissions = {};
      if (userProfile.role === 'admin' || userProfile.role === 'super_admin') {
        effectivePermissions = { all: true };
      } else {
        const directPermissions = parsePermissions(userProfile.permissions);
        if (Object.keys(directPermissions).length > 0) {
          effectivePermissions = directPermissions;
        } else {
          try {
            const roleRows = await db.query(
              `SELECT permissions
                 FROM roles
                WHERE institution_id = ? AND name = ? AND status = 'active'
                LIMIT 1`,
              [req.institutionId, userProfile.role]
            );
            if (roleRows.length > 0) {
              effectivePermissions = parsePermissions(roleRows[0].permissions);
            }
          } catch (error) {
            logger.warn('Failed to resolve role permissions in profile', {
              userId: req.user.userId,
              institutionId: req.institutionId,
              role: userProfile.role,
              error: error.message
            });
          }

          if (!effectivePermissions || Object.keys(effectivePermissions).length === 0) {
            const { ROLE_PERMISSIONS } = require('../../constants/permissions');
            effectivePermissions = ROLE_PERMISSIONS[userProfile.role] || {};
          }
        }
      }

      res.json({
        success: true,
        data: {
          id: userProfile.id,
          userId: req.user.userId,
          institutionId: req.user.institutionId,
          institutionName: userProfile.institution_name,
          email: userProfile.email,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          role: userProfile.role,
          department: userProfile.department,
          designation: userProfile.designation,
          employeeId: userProfile.employee_id,
          permissions: effectivePermissions,
          twoFactorEnabled: Boolean(userProfile.two_factor_enabled)
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

  async heartbeat(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token required' });
      }

      const { lastActivity } = req.body;
      const inactivityTimeoutMs = parseInt(process.env.SESSION_TIMEOUT_MS) || 900000;

      // If frontend reports lastActivity, validate it server-side
      if (lastActivity) {
        const inactiveSince = Date.now() - parseInt(lastActivity);
        if (inactiveSince > inactivityTimeoutMs) {
          logger.debug('Heartbeat rejected — frontend inactivity exceeded', { inactiveSince, inactivityTimeoutMs });
          return res.status(401).json({
            success: false,
            error: 'SESSION_EXPIRED',
            code: 'SESSION_EXPIRED'
          });
        }
      }

      const token = authHeader.substring(7);
      const result = await authService.refreshToken(token);

      // Decode new token expiry so frontend can sync its countdown
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(result.token);
      const sessionExpiresAt = decoded?.exp ? decoded.exp * 1000 : null;

      res.json({
        success: true,
        data: { token: result.token, sessionExpiresAt }
      });
    } catch (error) {
      logger.debug('Heartbeat token refresh failed', { error: error.message });
      res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        code: 'SESSION_EXPIRED'
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

  async sendTwoFactorEnableOtp(req, res) {
    try {
      const result = await authService.sendTwoFactorEnableOtp(req.institutionId, req.user.userId);
      res.json({
        success: true,
        message: 'OTP sent to your email address.',
        data: { email: result.email }
      });
    } catch (error) {
      logger.error('Send 2FA enable OTP failed', { error: error.message, userId: req.user.userId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyTwoFactorEnable(req, res) {
    try {
      const { otp } = req.body;
      if (!otp) {
        return res.status(400).json({ success: false, error: 'OTP is required.' });
      }
      const result = await authService.verifyAndEnableTwoFactor(req.institutionId, req.user.userId, otp);
      res.json({
        success: true,
        message: 'Two-factor authentication enabled successfully.',
        data: result
      });
    } catch (error) {
      logger.error('Verify 2FA enable failed', { error: error.message, userId: req.user.userId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async sendTwoFactorDisableOtp(req, res) {
    try {
      const result = await authService.sendTwoFactorDisableOtp(req.institutionId, req.user.userId);
      res.json({
        success: true,
        message: 'OTP sent to your email address.',
        data: { email: result.email }
      });
    } catch (error) {
      logger.error('Send 2FA disable OTP failed', { error: error.message, userId: req.user.userId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyTwoFactorDisable(req, res) {
    try {
      const { otp } = req.body;
      if (!otp) {
        return res.status(400).json({ success: false, error: 'OTP is required.' });
      }
      const result = await authService.verifyAndDisableTwoFactor(req.institutionId, req.user.userId, otp);
      res.json({
        success: true,
        message: 'Two-factor authentication disabled successfully.',
        data: result
      });
    } catch (error) {
      logger.error('Verify 2FA disable failed', { error: error.message, userId: req.user.userId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateAccountSettings(req, res) {
    try {
      const userId = req.user.userId;
      const institutionId = req.institutionId;
      const updateData = req.body;

      await authService.updateAccountSettings(institutionId, userId, updateData);

      const users = await authService.getInstitutionUsers(institutionId);
      const userProfile = users.find(u => u.id === userId);

      res.json({
        success: true,
        message: 'Account settings updated successfully',
        data: {
          id: userProfile.id,
          email: userProfile.email,
          mobile: userProfile.mobile,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          address: userProfile.address,
          city: userProfile.city,
          state: userProfile.state,
          country: userProfile.country,
          postalCode: userProfile.postal_code,
          dateOfBirth: userProfile.date_of_birth,
          gender: userProfile.gender,
          twoFactorEnabled: Boolean(userProfile.two_factor_enabled)
        }
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
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token required' });
      }
      const token = authHeader.substring(7);
      // Use refreshToken with grace period so near-expired/just-expired tokens still work
      const result = await authService.refreshToken(token);
      res.json({
        success: true,
        data: { token: result.token }
      });
    } catch (error) {
      logger.error('Session extension failed', { error: error.message });
      res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        code: 'SESSION_EXPIRED'
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

  // Institution management endpoints
  async getInstitutionInfo(req, res) {
    try {
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
      const institutionId = req.institutionId;
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

  async updateInstitutionDetails(req, res) {
    try {
      const { 
        address, city, state, country, postalCode,
        institutionType, registrationNumber, taxId, website, contactPerson
      } = req.body;
      
      await authService.updateInstitutionDetails(req.institutionId, {
        address, city, state, country, postalCode,
        institutionType, registrationNumber, taxId, website, contactPerson
      });
      
      res.json({
        success: true,
        message: 'Institution details updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update institution details', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: 'Email is required.' });
      await authService.forgotPassword(email);
      res.json({ success: true, message: 'If this email is registered, an OTP has been sent.' });
    } catch (error) {
      logger.error('Forgot password failed', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async verifyResetOtp(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
      const result = await authService.verifyResetOtp(email, otp);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Reset OTP verification failed', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const { resetToken, newPassword } = req.body;
      if (!resetToken || !newPassword) return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
      if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
      await authService.resetPassword(resetToken, newPassword);
      res.json({ success: true, message: 'Password reset successfully. Please login.' });
    } catch (error) {
      logger.error('Password reset failed', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getEmailHint(req, res) {
    try {
      const { mobile } = req.body;
      if (!mobile) return res.status(400).json({ success: false, error: 'Mobile number is required.' });
      const result = await authService.getEmailHintByMobile(mobile);
      if (!result.found) {
        return res.json({
          success: true,
          found: false,
          message: 'No account found with this mobile number. Please contact us for further assistance.'
        });
      }
      res.json({ success: true, found: true, hints: result.hints });
    } catch (error) {
      logger.error('Get email hint failed', { error: error.message });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AuthController();
