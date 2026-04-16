const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const config = require('../../config');
const logger = require('../../utils/logger');
const { ROLE_PERMISSIONS } = require('../../constants/permissions');
const emailService = require('../../services/emailService');

// In-memory OTP store
// Login OTPs: key = `${email}:${institutionId}`, value = { otp, expiresAt, userId, institutionId }
// Registration OTPs: key = `reg:${email}`, value = { otp, expiresAt }
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

class AuthService {
  // Helper function to convert undefined to null
  _toNull(value) {
    return value === undefined ? null : value;
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

  async issueToken(email, institutionId = null) {
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

    const token = jwt.sign(
      {
        userId: user.id,
        institutionId: user.institution_id,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || [],
        sessionTimestamp: Date.now()
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('Token issued', { userId: user.id, email: user.email });
    return {
      token,
      user: {
        id: user.id,
        institutionId: user.institution_id,
        institutionName: user.institution_name,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || []
      }
    };
  }

  // Step 1: validate credentials, generate & email OTP
  async initiateLogin(email, password, institutionId = null) {
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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${email}:${user.institution_id}`;
    otpStore.set(key, { otp, expiresAt: Date.now() + OTP_TTL_MS, userId: user.id, institutionId: user.institution_id });

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
    return { email, institutionId: user.institution_id };
  }

  // Send OTP for pre-registration email verification
  async sendRegistrationOtp(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `reg:${email}`;
    otpStore.set(key, { otp, expiresAt: Date.now() + OTP_TTL_MS });

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
    const key = `reg:${email}`;
    const record = otpStore.get(key);

    if (!record) throw new Error('OTP not found or already used. Please request a new OTP.');
    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      throw new Error('OTP has expired. Please request a new OTP.');
    }
    if (record.otp !== otp) throw new Error('Invalid OTP.');

    otpStore.delete(key); // one-time use
    return { success: true };
  }

  // Step 2: verify login OTP and issue JWT
  async verifyOtp(email, otp, institutionId) {
    const key = `${email}:${institutionId}`;
    const record = otpStore.get(key);

    if (!record) throw new Error('OTP not found or already used. Please login again.');
    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      throw new Error('OTP has expired. Please login again.');
    }
    if (record.otp !== otp) throw new Error('Invalid OTP.');

    otpStore.delete(key); // one-time use
    return this.issueToken(email, institutionId);
  }

  async authenticateUser(email, password, institutionId = null) {
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

    // Update last login
    await db.query(
      'UPDATE institution_users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate JWT token with session timestamp
    const sessionTimestamp = Date.now();
    const token = jwt.sign(
      {
        userId: user.id,
        institutionId: user.institution_id,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || [],
        sessionTimestamp
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('User authenticated', { userId: user.id, institutionId: user.institution_id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        institutionId: user.institution_id,
        institutionName: user.institution_name,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || []
      }
    };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Verify user still exists and is active
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

      return decoded;
    } catch (error) {
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
      const sessionTimestamp = Date.now();
      const newToken = jwt.sign(
        {
          userId: user.id,
          institutionId: user.institution_id,
          email: user.email,
          role: user.role,
          permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
          warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || [],
          sessionTimestamp
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        token: newToken,
        user: {
          id: user.id,
          institutionId: user.institution_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
          warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || []
        }
      };
    } catch (error) {
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
              status, last_login, created_at, department, designation, employee_id
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

  async changePassword(institutionId, userId, currentPassword, newPassword) {
    // Get current password hash
    const users = await db.query(
      'SELECT password_hash FROM institution_users WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.query(
      'UPDATE institution_users SET password_hash = ?, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [newPasswordHash, institutionId, userId]
    );

    logger.info('User password changed', { userId, institutionId });
  }

  async updateAccountSettings(institutionId, userId, updateData) {
    const { firstName, lastName, email, mobile, address, city, state, country, postalCode, dateOfBirth, gender } = updateData;
    
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
    
    // Generate new token with updated session timestamp
    const sessionTimestamp = Date.now();
    const token = jwt.sign(
      {
        userId: user.id,
        institutionId: user.institution_id,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || [],
        sessionTimestamp
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    logger.info('Session extended', { userId, institutionId });
    return { token, sessionTimestamp };
  }

  async generateTempAccess(institutionId, targetUserId, adminUserId, expiresInHours) {
    // For now, return a simple temp access token
    const tempToken = uuidv4();
    logger.info('Temp access generated', { institutionId, targetUserId, adminUserId });
    return { tempToken, expiresInHours };
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
    const key = `reset:${email}`;
    otpStore.set(key, { otp, expiresAt: Date.now() + OTP_TTL_MS });

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
    const key = `reset:${email}`;
    const record = otpStore.get(key);

    if (!record) throw new Error('OTP not found or already used. Please request a new OTP.');
    if (Date.now() > record.expiresAt) {
      otpStore.delete(key);
      throw new Error('OTP has expired. Please request a new OTP.');
    }
    if (record.otp !== otp) throw new Error('Invalid OTP.');

    otpStore.delete(key);

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