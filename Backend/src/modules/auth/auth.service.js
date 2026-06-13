const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const config = require('../../config');
const logger = require('../../utils/logger');
const { ROLE_PERMISSIONS } = require('../../constants/permissions');
const emailService = require('../../services/emailService');
const otpService = require('./otp.service');
const userSessionService = require('./userSession.service');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

class AuthService {
  // Helper function to convert undefined to null
  _toNull(value) {
    return value === undefined ? null : value;
  }

  _parsePermissions(raw) {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch (_) {
        return {};
      }
    }
    return {};
  }

  _parseWarehouseAccess(raw) {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return raw.map((v) => String(v)).filter(Boolean);

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith('[') || trimmed.startsWith('"')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
          if (typeof parsed === 'string' && parsed) return [parsed];
        } catch (_) {
          // fall through to plain parsing
        }
      }

      if (trimmed.includes(',')) {
        return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
      }
      return [trimmed];
    }

    return [];
  }

  async _resolveEffectivePermissions(user) {
    if (!user) return {};
    if (user.role === 'admin' || user.role === 'super_admin') {
      return { all: true };
    }

    const directPermissions = this._parsePermissions(user.permissions);
    if (Object.keys(directPermissions).length > 0) {
      return directPermissions;
    }

    // Fallback to custom role permissions table when user-level permissions are empty.
    if (user.institution_id && user.role) {
      try {
        const roleRows = await db.query(
          `SELECT permissions
             FROM roles
            WHERE institution_id = ? AND name = ? AND status = 'active'
            LIMIT 1`,
          [user.institution_id, user.role]
        );
        if (roleRows.length > 0) {
          const rolePermissions = this._parsePermissions(roleRows[0].permissions);
          if (Object.keys(rolePermissions).length > 0) {
            return rolePermissions;
          }
        }
      } catch (error) {
        logger.warn('Could not resolve role-based permissions', {
          userId: user.id,
          institutionId: user.institution_id,
          role: user.role,
          error: error.message
        });
      }
    }

    return ROLE_PERMISSIONS[user.role] || {};
  }

  // Create new institution (replaces createinstitution)
  async createInstitution(institutionData) {
    const { 
      name, email, mobile, address, city, state, country, postalCode,
      institutionType, registrationNumber, taxId, website, contactPerson,
      adminEmail, adminMobile, adminPassword, adminFirstName, adminLastName,
      adminAddress, adminCity, adminState, adminCountry, adminPostalCode, 
      adminDateOfBirth, adminGender, adminDepartment, adminDesignation 
    } = institutionData;
    
    // Use admin email as institution email if not provided
    const institutionEmail = email || adminEmail;
    
    // Check if institution email already exists
    const existingInstitution = await db.query(
      'SELECT id FROM institutions WHERE email = ?',
      [institutionEmail]
    );

    if (existingInstitution.length > 0) {
      throw new Error('Email already registered');
    }
    
    const institutionId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await db.transaction(async (connection) => {
      // Create institution with owner as contact person
      await connection.execute(
        `INSERT INTO institutions (id, name, email, mobile, address, city, state, country, postal_code,
         institution_type, registration_number, tax_id, website, contact_person, status, plan, settings) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'starter', '{}')`,
        [
          institutionId, 
          this._toNull(name), 
          institutionEmail, 
          this._toNull(adminMobile), 
          this._toNull(address), 
          this._toNull(city), 
          this._toNull(state), 
          this._toNull(country), 
          this._toNull(postalCode), 
          this._toNull(institutionType),
          this._toNull(registrationNumber), 
          this._toNull(taxId), 
          this._toNull(website), 
          `${adminFirstName} ${adminLastName}`
        ]
      );

      // Create super admin user as institution owner
      await connection.execute(
        `INSERT INTO institution_users (id, institution_id, email, mobile, password_hash, first_name, last_name, 
         address, city, state, country, postal_code, date_of_birth, gender, department, designation, 
         role, permissions, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'super_admin', '{"all": true}', 'active')`,
        [
          userId, 
          institutionId, 
          adminEmail, 
          this._toNull(adminMobile), 
          passwordHash, 
          this._toNull(adminFirstName), 
          this._toNull(adminLastName),
          this._toNull(adminAddress), 
          this._toNull(adminCity), 
          this._toNull(adminState), 
          this._toNull(adminCountry), 
          this._toNull(adminPostalCode), 
          this._toNull(adminDateOfBirth), 
          this._toNull(adminGender), 
          this._toNull(adminDepartment), 
          this._toNull(adminDesignation)
        ]
      );
    });

    logger.info('Institution created with owner', { institutionId, adminEmail });

    // Auto-create 14-day trial subscription on Starter plan
    try {
      const subscriptionService = require('../subscription/subscription.service');
      await subscriptionService.createTrialSubscription(institutionId);
    } catch (subErr) {
      logger.warn('Failed to create trial subscription for new institution', { institutionId, error: subErr.message });
    }

    return { institutionId, userId, needsAdditionalInfo: true };
  }

  async validateCredentials(email, password, institutionId = null) {
    let query = `SELECT u.*, i.status as institution_status, i.name as institution_name 
                 FROM institution_users u 
                 JOIN institutions i ON u.institution_id = i.id 
                 WHERE u.email = ?`;
    let params = [email];
    if (institutionId) { query += ' AND u.institution_id = ?'; params.push(institutionId); }

    const users = await db.query(query, params);
    if (users.length === 0) throw new Error('Email or password is incorrect. Please check your credentials and try again.');

    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    if (user.institution_status !== 'active') throw new Error('Institution account is suspended');

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw new Error('Email or password is incorrect. Please check your credentials and try again.');

    return { email: user.email, institutionId: user.institution_id };
  }

  _signUserToken(user, effectivePermissions, sessionId, sessionTimestamp = Date.now()) {
    const payload = {
      userId: user.id,
      institutionId: user.institution_id,
      email: user.email,
      role: user.role,
      permissions: effectivePermissions,
      warehouseAccess: this._parseWarehouseAccess(user.warehouse_access),
      sessionTimestamp,
    };
    if (sessionId) payload.sessionId = sessionId;
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  }

  _mapAuthUser(user, effectivePermissions) {
    return {
      id: user.id,
      institutionId: user.institution_id,
      institutionName: user.institution_name,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      permissions: effectivePermissions,
      warehouseAccess: this._parseWarehouseAccess(user.warehouse_access),
    };
  }

  async issueToken(email, institutionId = null, meta = {}) {
    let query = `SELECT u.*, i.status as institution_status, i.name as institution_name 
                 FROM institution_users u 
                 JOIN institutions i ON u.institution_id = i.id 
                 WHERE u.email = ?`;
    let params = [email];
    if (institutionId) { query += ' AND u.institution_id = ?'; params.push(institutionId); }

    const users = await db.query(query, params);
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];

    await db.query('UPDATE institution_users SET last_login = NOW() WHERE id = ?', [user.id]);

    const effectivePermissions = await this._resolveEffectivePermissions(user);
    const sessionId = await userSessionService.createSession({
      userId: user.id,
      institutionId: user.institution_id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    const sessionTimestamp = Date.now();
    const token = this._signUserToken(user, effectivePermissions, sessionId, sessionTimestamp);

    logger.info('Token issued', { userId: user.id, email: user.email, sessionId });
    return {
      token,
      user: this._mapAuthUser(user, effectivePermissions),
    };
  }

  async _validateLoginCredentials(email, password, institutionId = null) {
    let query = `SELECT u.*, i.status as institution_status, i.name as institution_name
                 FROM institution_users u
                 JOIN institutions i ON u.institution_id = i.id
                 WHERE u.email = ?`;
    let params = [email];
    if (institutionId) { query += ' AND u.institution_id = ?'; params.push(institutionId); }

    const users = await db.query(query, params);
    if (users.length === 0) throw new Error('Email or password is incorrect. Please check your credentials and try again.');

    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    if (user.institution_status !== 'active') throw new Error('Institution account is suspended');

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) throw new Error('Email or password is incorrect. Please check your credentials and try again.');

    return user;
  }

  // Step 1: validate credentials, generate & email OTP
  async initiateLogin(email, password, institutionId = null, meta = {}) {
    const user = await this._validateLoginCredentials(email, password, institutionId);

    if (!user.two_factor_enabled) {
      logger.info('Login successful without OTP (2FA disabled)', { userId: user.id, email, institutionId: user.institution_id });
      const tokenData = await this.issueToken(user.email, user.institution_id, meta);
      return {
        requiresOtp: false,
        tokenData
      };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpService.createOtp({
      purpose: 'login',
      email,
      otp,
      institutionId: user.institution_id,
      userId: user.id,
      ttlMs: OTP_TTL_MS
    });

    // Send OTP email (non-fatal — log warning if email fails)
    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Your Login OTP',
        text: `Your OTP is: ${otp}. It expires in 5 minutes.`,
        html: `<p>Your login OTP is: <strong>${otp}</strong></p><p>It expires in 5 minutes. Do not share it with anyone.</p>`
      });
    } catch (emailErr) {
      logger.warn('OTP email failed, OTP still stored', { email, error: emailErr.message });
    }

    logger.info('OTP sent', { userId: user.id, email, otp });
    return { requiresOtp: true, email, institutionId: user.institution_id };
  }

  // Send OTP for pre-registration email verification
  async sendRegistrationOtp(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpService.createOtp({
      purpose: 'registration',
      email,
      otp,
      ttlMs: OTP_TTL_MS
    });

    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Your Registration OTP',
        text: `Your registration OTP is: ${otp}. It expires in 5 minutes.`,
        html: `<p>Your registration OTP is: <strong>${otp}</strong></p><p>It expires in 5 minutes. Do not share it with anyone.</p>`
      });
    } catch (emailErr) {
      logger.warn('Registration OTP email failed, OTP still stored', { email, error: emailErr.message });
    }

    logger.info('Registration OTP sent', { email, otp });
    return { success: true };
  }

  // Verify pre-registration OTP (does NOT issue JWT)
  async verifyRegistrationOtp(email, otp) {
    await otpService.verifyOtp({ purpose: 'registration', email, otp });
    return { success: true };
  }

  // Step 2: verify login OTP and issue JWT
  async verifyOtp(email, otp, institutionId, meta = {}) {
    try {
      await otpService.verifyOtp({ purpose: 'login', email, otp, institutionId });
    } catch (err) {
      // Preserve the "login again" hint on missing/expired login OTPs
      if (err.message && err.message.includes('not found')) {
        throw new Error('OTP not found or already used. Please login again.');
      }
      if (err.message && err.message.includes('expired')) {
        throw new Error('OTP has expired. Please login again.');
      }
      throw err;
    }
    return this.issueToken(email, institutionId, meta);
  }

  async authenticateUser(email, password, institutionId = null, meta = {}) {
    let query = `SELECT u.*, i.status as institution_status, i.name as institution_name 
                 FROM institution_users u 
                 JOIN institutions i ON u.institution_id = i.id 
                 WHERE u.email = ?`;
    let params = [email];

    if (institutionId) {
      query += ' AND u.institution_id = ?';
      params.push(institutionId);
    }

    const users = await db.query(query, params);

    if (users.length === 0) {
      throw new Error('Email or password is incorrect. Please check your credentials and try again.');
    }

    const user = users[0];

    if (user.status !== 'active') {
      throw new Error('User account is inactive');
    }

    if (user.institution_status !== 'active') {
      throw new Error('Institution account is suspended');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Email or password is incorrect. Please check your credentials and try again.');
    }

    await db.query(
      'UPDATE institution_users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    const effectivePermissions = await this._resolveEffectivePermissions(user);
    const sessionId = await userSessionService.createSession({
      userId: user.id,
      institutionId: user.institution_id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    const sessionTimestamp = Date.now();
    const token = this._signUserToken(user, effectivePermissions, sessionId, sessionTimestamp);

    logger.info('User authenticated', {
      userId: user.id,
      institutionId: user.institution_id,
      email: user.email,
      sessionId,
    });

    return {
      token,
      user: this._mapAuthUser(user, effectivePermissions),
    };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      await userSessionService.assertSessionValid(decoded.sessionId);

      const users = await db.query(
        `SELECT u.*, i.status as institution_status 
         FROM institution_users u 
         JOIN institutions i ON u.institution_id = i.id 
         WHERE u.id = ? lIMIT 1`,
        [decoded.userId]
      );

      if (users.length === 0 || users[0].status !== 'active' || users[0].institution_status !== 'active') {
        throw new Error('Invalid token');
      }

      const user = users[0];
      const effectivePermissions = await this._resolveEffectivePermissions(user);

      if (decoded.sessionId) {
        userSessionService.touchSession(decoded.sessionId).catch(() => {});
      }

      return {
        ...decoded,
        role: user.role,
        permissions: effectivePermissions,
        warehouseAccess: this._parseWarehouseAccess(user.warehouse_access),
      };
    } catch (error) {
      if (error.code === 'SESSION_REVOKED') throw error;
      throw new Error('Invalid token');
    }
  }

  async refreshToken(token, allowExpiredGraceSecs = 600) {
    try {
      // Allow recently-expired tokens within grace window so active users aren't kicked out
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          decoded = jwt.decode(token);
          if (!decoded || !decoded.exp) throw err;
          const expiredAgo = Math.floor(Date.now() / 1000) - decoded.exp;
          if (expiredAgo > allowExpiredGraceSecs) {
            throw err; // preserve TokenExpiredError so callers can distinguish
          }
          // within grace period — decoded is set, continue to issue new token
        } else {
          throw err;
        }
      }

      const users = await db.query(
        `SELECT u.*, i.status as institution_status 
         FROM institution_users u 
         JOIN institutions i ON u.institution_id = i.id 
         WHERE u.id = ?`,
        [decoded.userId]
      );

      if (users.length === 0 || users[0].status !== 'active' || users[0].institution_status !== 'active') {
        throw new Error('Invalid token');
      }

      const user = users[0];
      const effectivePermissions = await this._resolveEffectivePermissions(user);

      let sessionId = decoded.sessionId;
      if (sessionId) {
        await userSessionService.assertSessionValid(sessionId);
        await userSessionService.touchSession(sessionId);
      } else {
        sessionId = await userSessionService.createSession({
          userId: user.id,
          institutionId: user.institution_id,
        });
      }

      const sessionTimestamp = Date.now();
      const newToken = this._signUserToken(user, effectivePermissions, sessionId, sessionTimestamp);

      return {
        token: newToken,
        user: {
          id: user.id,
          institutionId: user.institution_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          permissions: effectivePermissions,
          warehouseAccess: this._parseWarehouseAccess(user.warehouse_access),
        },
      };
    } catch (error) {
      if (error.code === 'SESSION_REVOKED') throw error;
      throw new Error(error.message || 'Invalid or expired token');
    }
  }

  async createUser(institutionId, userData, createdBy) {
    const { 
      email, mobile, password, firstName, lastName, address, city, state, country, 
      postalCode, dateOfBirth, gender, department, designation, employeeId,
      role = 'user', permissions = {}, warehouseAccess = [] 
    } = userData;

    // Check if user already exists in this institution
    const existingUser = await db.query(
      'SELECT id FROM institution_users WHERE institution_id = ? AND email = ?',
      [institutionId, email]
    );

    if (existingUser.length > 0) {
      throw new Error('Email already registered in this institution');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Merge default role permissions with custom permissions
    const defaultPermissions = ROLE_PERMISSIONS[role] || {};
    const finalPermissions = { ...defaultPermissions, ...permissions };

    await db.query(
      `INSERT INTO institution_users (id, institution_id, email, mobile, password_hash, first_name, last_name, 
       address, city, state, country, postal_code, date_of_birth, gender, department, designation, employee_id,
       role, permissions, warehouse_access, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [userId, institutionId, email, this._toNull(mobile), passwordHash, firstName, lastName,
       this._toNull(address), this._toNull(city), this._toNull(state), this._toNull(country), this._toNull(postalCode), 
       this._toNull(dateOfBirth), this._toNull(gender), this._toNull(department), this._toNull(designation), this._toNull(employeeId),
       role, JSON.stringify(finalPermissions), JSON.stringify(warehouseAccess), createdBy]
    );

    logger.info('User created', { userId, institutionId, email, createdBy });
    return userId;
  }

  async updateUserPermissions(institutionId, userId, permissions, warehouseAccess, role = null) {
    // Check if user exists
    const checkUser = await db.query(
      'SELECT id, role, permissions FROM institution_users WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );
    
    if (checkUser.length === 0) {
      throw new Error('User not found');
    }
    
    // Prevent modifying super_admin permissions
    if (checkUser[0].role === 'super_admin') {
      throw new Error('Cannot modify super admin permissions');
    }
    
    let query = 'UPDATE institution_users SET permissions = ?, warehouse_access = ?';
    let params = [JSON.stringify(permissions), JSON.stringify(warehouseAccess)];
    
    if (role) {
      query += ', role = ?';
      params.push(role);
    }
    
    query += ', updated_at = NOW() WHERE institution_id = ? AND id = ?';
    params.push(institutionId, userId);
    
    const result = await db.query(query, params);
    
    logger.info('User permissions updated', { 
      userId, 
      institutionId, 
      role, 
      affectedRows: result.affectedRows
    });
    
    if (result.affectedRows === 0) {
      throw new Error('User not found or no changes made');
    }
  }

  async updateUserStatus(institutionId, userId, status) {
    // Check if user exists and get their role
    const users = await db.query(
      'SELECT role FROM institution_users WHERE id = ? AND institution_id = ?',
      [userId, institutionId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    // Only prevent deactivating super_admin users
    if (users[0].role === 'super_admin' && status === 'inactive') {
      throw new Error('Institution owner cannot be deactivated');
    }

    // Update user status
    const result = await db.query(
      'UPDATE institution_users SET status = ?, updated_at = NOW() WHERE id = ? AND institution_id = ?',
      [status, userId, institutionId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Failed to update user status');
    }

    logger.info('User status updated', { userId, institutionId, status });
  }

  async getInstitutionUsers(institutionId, limit = 50, offset = 0) {
    return await db.query(
      `SELECT id, email, first_name, last_name, role, permissions, warehouse_access,
              status, two_factor_enabled, last_login, created_at, department, designation, employee_id,
              mobile, address, city, state, country, postal_code, date_of_birth, gender
       FROM institution_users 
       WHERE institution_id = ? 
       ORDER BY created_at DESC`,
      [institutionId]
    );
  }

  async getInstitutionByEmail(email) {
    const institutions = await db.query(
      'SELECT * FROM institutions WHERE email = ? AND status = "active"',
      [email]
    );
    return institutions[0] || null;
  }

  async updateInstitutionSettings(institutionId, settings) {
    await db.query(
      'UPDATE institutions SET settings = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(settings), institutionId]
    );

    logger.info('Institution settings updated', { institutionId });
  }

  async updateInstitutionDetails(institutionId, details) {
    const { address, city, state, country, postalCode, institutionType, registrationNumber, taxId, website, contactPerson } = details;
    
    await db.query(
      `UPDATE institutions SET address = ?, city = ?, state = ?, country = ?, postal_code = ?,
       institution_type = ?, registration_number = ?, tax_id = ?, website = ?, contact_person = ?, updated_at = NOW()
       WHERE id = ?`,
      [this._toNull(address), this._toNull(city), this._toNull(state), this._toNull(country), this._toNull(postalCode),
       this._toNull(institutionType), this._toNull(registrationNumber), this._toNull(taxId), this._toNull(website), this._toNull(contactPerson),
       institutionId]
    );

    logger.info('Institution details updated', { institutionId });
  }

  // Backward compatibility methods
  async createinstitution(institutionData) {
    return this.createInstitution(institutionData);
  }

  async getinstitutionUsers(institutionId, limit, offset) {
    return this.getInstitutionUsers(institutionId, limit, offset);
  }

  async getinstitutionBySubdomain(subdomain) {
    return this.getInstitutionByEmail(subdomain);
  }

  async updateinstitutionSettings(institutionId, settings) {
    return this.updateInstitutionSettings(institutionId, settings);
  }

  async updateUserProfile(institutionId, userId, updateData) {
    const { firstName, lastName, email } = updateData;
    
    // Check if email is being changed and if it already exists
    if (email) {
      const existingUser = await db.query(
        'SELECT id FROM institution_users WHERE institution_id = ? AND email = ? AND id != ?',
        [institutionId, email, userId]
      );
      
      if (existingUser.length > 0) {
        throw new Error('Email already exists');
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(institutionId, userId);

    const result = await db.query(
      `UPDATE institution_users SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('User not found');
    }

    logger.info('User profile updated', { userId, institutionId });
  }

  async sendPasswordChangeOtp(institutionId, userId, currentPassword) {
    if (!currentPassword) throw new Error('Current password is required');

    const users = await db.query(
      'SELECT id, email, password_hash, status FROM institution_users WHERE institution_id = ? AND id = ? LIMIT 1',
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) throw new Error('Current password is incorrect');

    const otp = generateOtpCode();
    await otpService.createOtp({
      purpose: 'password_change',
      email: user.email,
      otp,
      institutionId,
      userId: user.id,
      ttlMs: OTP_TTL_MS,
    });
    await this._sendOtpEmail(
      user.email,
      'Confirm Password Change',
      'Your code to change your password is',
      otp
    );

    logger.info('Password change OTP sent', { userId, institutionId, email: user.email });
    return { email: user.email };
  }

  async changePassword(institutionId, userId, currentPassword, newPassword, otp) {
    if (!otp) {
      throw new Error('OTP is required to change your password. Request a verification code first.');
    }

    const user = await this._getActiveUser(institutionId, userId);
    const users = await db.query(
      'SELECT password_hash FROM institution_users WHERE institution_id = ? AND id = ? LIMIT 1',
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');

    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    await otpService.verifyOtp({
      purpose: 'password_change',
      email: user.email,
      otp: String(otp).trim(),
      institutionId,
    });

    if (!newPassword || String(newPassword).length < 6) {
      throw new Error('New password must be at least 6 characters');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE institution_users SET password_hash = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [newPasswordHash, institutionId, userId]
    );

    logger.info('User password changed', { userId, institutionId });
  }

  async sendTwoFactorEnableOtp(institutionId, userId) {
    const users = await db.query(
      `SELECT id, email, two_factor_enabled, status
         FROM institution_users
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    if (user.two_factor_enabled) throw new Error('Two-factor authentication is already enabled.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpService.createOtp({
      purpose: 'two_factor_enable',
      email: user.email,
      otp,
      institutionId,
      userId: user.id,
      ttlMs: OTP_TTL_MS
    });

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Confirm Two-Factor Authentication',
        text: `Your code to enable two-factor authentication is: ${otp}. It expires in 5 minutes.`,
        html: `<p>Your code to enable two-factor authentication is: <strong>${otp}</strong></p><p>It expires in 5 minutes. Do not share it with anyone.</p>`
      });
    } catch (emailErr) {
      logger.warn('2FA enable OTP email failed, OTP still stored', { email: user.email, error: emailErr.message });
    }

    logger.info('2FA enable OTP sent', { userId: user.id, email: user.email });
    return { email: user.email };
  }

  async verifyAndEnableTwoFactor(institutionId, userId, otp) {
    const users = await db.query(
      `SELECT id, email, two_factor_enabled, status
         FROM institution_users
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    if (user.two_factor_enabled) throw new Error('Two-factor authentication is already enabled.');

    await otpService.verifyOtp({
      purpose: 'two_factor_enable',
      email: user.email,
      otp,
      institutionId
    });

    await db.query(
      'UPDATE institution_users SET two_factor_enabled = 1, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );

    logger.info('Two-factor authentication enabled', { userId, institutionId });
    return { twoFactorEnabled: true, email: user.email };
  }

  async sendTwoFactorDisableOtp(institutionId, userId) {
    const users = await db.query(
      `SELECT id, email, two_factor_enabled, status
         FROM institution_users
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    if (!user.two_factor_enabled) throw new Error('Two-factor authentication is already disabled.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpService.createOtp({
      purpose: 'two_factor_disable',
      email: user.email,
      otp,
      institutionId,
      userId: user.id,
      ttlMs: OTP_TTL_MS
    });

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Confirm Two-Factor Disable',
        text: `Your code to disable two-factor authentication is: ${otp}. It expires in 5 minutes.`,
        html: `<p>Your code to disable two-factor authentication is: <strong>${otp}</strong></p><p>It expires in 5 minutes. Do not share it with anyone.</p>`
      });
    } catch (emailErr) {
      logger.warn('2FA disable OTP email failed, OTP still stored', { email: user.email, error: emailErr.message });
    }

    logger.info('2FA disable OTP sent', { userId: user.id, email: user.email });
    return { email: user.email };
  }

  async verifyAndDisableTwoFactor(institutionId, userId, otp) {
    const users = await db.query(
      `SELECT id, email, two_factor_enabled, status
         FROM institution_users
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    if (!user.two_factor_enabled) throw new Error('Two-factor authentication is already disabled.');

    await otpService.verifyOtp({
      purpose: 'two_factor_disable',
      email: user.email,
      otp,
      institutionId
    });

    await db.query(
      'UPDATE institution_users SET two_factor_enabled = 0, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );

    logger.info('Two-factor authentication disabled', { userId, institutionId });
    return { twoFactorEnabled: false, email: user.email };
  }

  async _getActiveUser(institutionId, userId) {
    const users = await db.query(
      `SELECT id, email, two_factor_enabled, status
         FROM institution_users
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, userId]
    );
    if (users.length === 0) throw new Error('User not found');
    const user = users[0];
    if (user.status !== 'active') throw new Error('User account is inactive');
    return user;
  }

  async _sendOtpEmail(to, subject, textPrefix, otp) {
    try {
      await emailService.sendEmail({
        to,
        subject,
        text: `${textPrefix}: ${otp}. It expires in 5 minutes.`,
        html: `<p>${textPrefix}: <strong>${otp}</strong></p><p>It expires in 5 minutes. Do not share it with anyone.</p>`,
      });
    } catch (emailErr) {
      logger.warn('Profile OTP email failed', { email: to, error: emailErr.message });
      throw new Error('Failed to send OTP email. Check SMTP configuration and try again.');
    }
  }

  async sendProfileUpdateOtp(institutionId, userId, { newEmail } = {}) {
    const user = await this._getActiveUser(institutionId, userId);
    const currentEmail = normalizeEmail(user.email);
    const nextEmail = newEmail ? normalizeEmail(newEmail) : null;
    const emailChanging = Boolean(nextEmail && nextEmail !== currentEmail);

    if (emailChanging) {
      if (!nextEmail.includes('@')) throw new Error('Valid new email is required');
      const existingUser = await db.query(
        'SELECT id FROM institution_users WHERE institution_id = ? AND LOWER(email) = ? AND id != ? LIMIT 1',
        [institutionId, nextEmail, userId]
      );
      if (existingUser.length > 0) throw new Error('Email already exists');
    }

    const currentOtp = generateOtpCode();
    await otpService.createOtp({
      purpose: 'profile_update',
      email: user.email,
      otp: currentOtp,
      institutionId,
      userId: user.id,
      ttlMs: OTP_TTL_MS,
    });
    await this._sendOtpEmail(
      user.email,
      'Confirm Profile Update',
      'Your code to confirm profile changes is',
      currentOtp
    );

    if (emailChanging) {
      const newOtp = generateOtpCode();
      await otpService.createOtp({
        purpose: 'profile_email_change',
        email: nextEmail,
        otp: newOtp,
        institutionId,
        userId: user.id,
        ttlMs: OTP_TTL_MS,
      });
      await this._sendOtpEmail(
        nextEmail,
        'Verify Your New Email Address',
        'Your code to verify your new email address is',
        newOtp
      );
    }

    logger.info('Profile update OTP sent', {
      userId,
      institutionId,
      emailChanging,
      currentEmail: user.email,
      newEmail: emailChanging ? nextEmail : null,
    });

    return {
      email: user.email,
      newEmail: emailChanging ? nextEmail : null,
      emailChangeRequired: emailChanging,
    };
  }

  async updateAccountSettings(institutionId, userId, updateData) {
    const {
      otp,
      newEmailOtp,
      firstName,
      lastName,
      email,
      mobile,
      address,
      city,
      state,
      country,
      postalCode,
      dateOfBirth,
      gender,
      twoFactorEnabled,
    } = updateData;

    const user = await this._getActiveUser(institutionId, userId);

    if (!otp) {
      throw new Error('OTP is required to update your profile. Request a verification code first.');
    }

    await otpService.verifyOtp({
      purpose: 'profile_update',
      email: user.email,
      otp: String(otp).trim(),
      institutionId,
    });

    const normalizedNewEmail = email !== undefined ? normalizeEmail(email) : null;
    const currentEmail = normalizeEmail(user.email);
    const emailChanging = normalizedNewEmail && normalizedNewEmail !== currentEmail;

    if (emailChanging) {
      if (!newEmailOtp) {
        throw new Error('OTP sent to your new email address is required to change your email.');
      }
      await otpService.verifyOtp({
        purpose: 'profile_email_change',
        email: normalizedNewEmail,
        otp: String(newEmailOtp).trim(),
        institutionId,
      });
    }

    if (email !== undefined) {
      const existingUser = await db.query(
        'SELECT id FROM institution_users WHERE institution_id = ? AND LOWER(email) = ? AND id != ? LIMIT 1',
        [institutionId, normalizedNewEmail, userId]
      );
      if (existingUser.length > 0) {
        throw new Error('Email already exists');
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (mobile !== undefined) {
      updateFields.push('mobile = ?');
      updateValues.push(this._toNull(mobile));
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(this._toNull(address));
    }
    if (city !== undefined) {
      updateFields.push('city = ?');
      updateValues.push(this._toNull(city));
    }
    if (state !== undefined) {
      updateFields.push('state = ?');
      updateValues.push(this._toNull(state));
    }
    if (country !== undefined) {
      updateFields.push('country = ?');
      updateValues.push(this._toNull(country));
    }
    if (postalCode !== undefined) {
      updateFields.push('postal_code = ?');
      updateValues.push(this._toNull(postalCode));
    }
    if (dateOfBirth !== undefined) {
      updateFields.push('date_of_birth = ?');
      updateValues.push(this._toNull(dateOfBirth));
    }
    if (gender !== undefined) {
      updateFields.push('gender = ?');
      updateValues.push(this._toNull(gender));
    }
    if (twoFactorEnabled !== undefined) {
      if (twoFactorEnabled) {
        throw new Error('To enable two-factor authentication, verify your email with the OTP sent from security settings.');
      }
      throw new Error('To disable two-factor authentication, verify your email with the OTP sent from security settings.');
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(institutionId, userId);

    const result = await db.query(
      `UPDATE institution_users SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('User not found');
    }

    logger.info('User account settings updated', { userId, institutionId });
  }

  async extendSession(userId, institutionId) {
    // Verify user is still active
    const users = await db.query(
      `SELECT u.*, i.status as institution_status 
       FROM institution_users u 
       JOIN institutions i ON u.institution_id = i.id 
       WHERE u.id = ? AND u.institution_id = ?`,
      [userId, institutionId]
    );

    if (users.length === 0 || users[0].status !== 'active' || users[0].institution_status !== 'active') {
      throw new Error('User or institution is inactive');
    }

    const user = users[0];
    const effectivePermissions = await this._resolveEffectivePermissions(user);
    const sessionTimestamp = Date.now();
    const token = this._signUserToken(user, effectivePermissions, null, sessionTimestamp);

    logger.info('Session extended', { userId, institutionId });
    return { token, sessionTimestamp };
  }

  async generateTempAccess(institutionId, targetUserId, adminUserId, expiresInHours) {
    const users = await db.query(
      `SELECT id, email, role
         FROM institution_users
        WHERE institution_id = ? AND id = ? AND status = 'active'
        LIMIT 1`,
      [institutionId, targetUserId]
    );
    if (users.length === 0) {
      throw new Error('Target user not found or inactive');
    }
    if (users[0].role === 'super_admin') {
      throw new Error('Cannot generate temporary access for super admin');
    }

    // Human-friendly but strong enough temporary password.
    const tempPassword = `Tmp@${uuidv4().replace(/-/g, '').slice(0, 10)}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    await db.query(
      'UPDATE institution_users SET password_hash = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [passwordHash, institutionId, targetUserId]
    );

    // Email send is best-effort; UI still receives the generated password.
    try {
      await emailService.sendEmail({
        to: users[0].email,
        subject: 'Temporary Access Password',
        text: `Your temporary password is: ${tempPassword}\nThis password should be changed immediately after login.`,
        html: `<p>Your temporary password is: <strong>${tempPassword}</strong></p><p>Please change it immediately after login.</p>`
      });
    } catch (emailErr) {
      logger.warn('Temp access email failed', { institutionId, targetUserId, error: emailErr.message });
    }

    logger.info('Temp access generated', { institutionId, targetUserId, adminUserId, expiresInHours });
    return { tempPassword, expiresInHours };
  }

  async loginWithTempAccess(email, tempPassword, institutionId) {
    // For now, just authenticate normally
    return this.authenticateUser(email, tempPassword, institutionId);
  }

  // Forgot password: send reset OTP to email
  async forgotPassword(email) {
    const users = await db.query(
      `SELECT u.id, u.email FROM institution_users u WHERE u.email = ? AND u.status = 'active' LIMIT 1`,
      [email]
    );
    if (users.length === 0) throw new Error('This email is not registered. Please check and try again.');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await otpService.createOtp({
      purpose: 'password_reset',
      email,
      otp,
      userId: users[0].id,
      ttlMs: OTP_TTL_MS
    });

    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Password Reset OTP',
        text: `Your password reset OTP is: ${otp}. It expires in 5 minutes. Do not share it.`,
        html: `<p>Your password reset OTP is: <strong>${otp}</strong></p><p>It expires in 5 minutes. Do not share it with anyone.</p>`
      });
    } catch (emailErr) {
      logger.warn('Reset OTP email failed', { email, error: emailErr.message });
    }

    logger.info('Password reset OTP sent', { email });
    return { success: true };
  }

  // Verify reset OTP and return a short-lived reset token
  async verifyResetOtp(email, otp) {
    await otpService.verifyOtp({ purpose: 'password_reset', email, otp });

    // Issue a short-lived reset token (10 min)
    const resetToken = require('jsonwebtoken').sign(
      { email, purpose: 'password_reset' },
      config.jwt.secret,
      { expiresIn: '10m' }
    );
    return { resetToken };
  }

  // Reset password using the reset token
  async resetPassword(resetToken, newPassword) {
    let decoded;
    try {
      decoded = require('jsonwebtoken').verify(resetToken, config.jwt.secret);
    } catch {
      throw new Error('Reset link has expired or is invalid. Please start over.');
    }
    if (decoded.purpose !== 'password_reset') throw new Error('Invalid reset token.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await db.query(
      `UPDATE institution_users SET password_hash = ?, updated_at = NOW() WHERE email = ? AND status = 'active'`,
      [passwordHash, decoded.email]
    );
    if (result.affectedRows === 0) throw new Error('User not found.');

    logger.info('Password reset successful', { email: decoded.email });
    return { success: true };
  }

  // Retrieve masked email hints by mobile number (multiple accounts supported)
  async getEmailHintByMobile(mobile) {
    const users = await db.query(
      `SELECT u.email, i.name as institution_name
       FROM institution_users u
       JOIN institutions i ON u.institution_id = i.id
       WHERE u.mobile = ? AND u.status = 'active'`,
      [mobile]
    );
    if (users.length === 0) return { found: false };

    const hints = users.map(u => {
      const [local, domain] = u.email.split('@');
      const masked = local.length <= 3
        ? local[0] + '***'
        : local.slice(0, 2) + '***' + local.slice(-1);
      return { hint: `${masked}@${domain}`, institutionName: u.institution_name };
    });

    return { found: true, hints };
  }
}

module.exports = new AuthService();