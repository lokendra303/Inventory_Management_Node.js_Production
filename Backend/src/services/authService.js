const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const config = require('../config');
const logger = require('../utils/logger');
const { ROLE_PERMISSIONS } = require('../constants/permissions');

class AuthService {
  async createInstitution(institutionData) {
    const { 
      name, adminEmail, adminMobile, adminPassword, adminFirstName, adminLastName,
      adminAddress, adminCity, adminState, adminCountry, adminPostalCode, 
      adminDateOfBirth, adminGender, adminDepartment, adminDesignation 
    } = institutionData;
    
    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM institution_users WHERE email = ?',
      [adminEmail]
    );

    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }
    
    const institutionId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await db.transaction(async (connection) => {
      // Create institution
      await connection.execute(
        `INSERT INTO institutions (id, name, plan, status, settings) 
         VALUES (?, ?, 'starter', 'active', '{}')`,
        [institutionId, name]
      );

      // Create admin user with null handling
      await connection.execute(
        `INSERT INTO institution_users (id, institution_id, email, mobile, password_hash, first_name, last_name, 
         address, city, state, country, postal_code, date_of_birth, gender, department, designation, 
         role, permissions, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', '{"all": true}', 'active')`,
        [userId, institutionId, adminEmail, adminMobile || null, passwordHash, adminFirstName, adminLastName,
         adminAddress || null, adminCity || null, adminState || null, adminCountry || null, adminPostalCode || null, 
         adminDateOfBirth || null, adminGender || null, adminDepartment || null, adminDesignation || null]
      );
    });

    logger.info('Institution created', { institutionId, adminEmail });
    return { institutionId, userId };
  }

  async authenticateUser(email, password, institutionId = null) {
    let query = 'SELECT u.*, t.status as institution_status FROM institution_users u JOIN institutions t ON u.institution_id = t.id WHERE u.email = ?';
    let params = [email];

    if (institutionId) {
      query += ' AND u.institution_id = ?';
      params.push(institutionId);
    }

    const users = await db.query(query, params);

    if (users.length === 0) {
      throw new Error('Invalid credentials');
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
      throw new Error('Invalid credentials');
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
      
      // Check session timeout (15 minutes = 900000ms)
      if (decoded.sessionTimestamp) {
        const sessionAge = Date.now() - decoded.sessionTimestamp;
        if (sessionAge > 15 * 60 * 1000) {
          throw new Error('Session expired due to inactivity');
        }
      }
      
      // Verify user still exists and is active
      const users = await db.query(
        'SELECT u.*, t.status as institution_status FROM institution_users u JOIN institutions t ON u.institution_id = t.id WHERE u.id = ?',
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

  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Verify user still exists and is active
      const users = await db.query(
        'SELECT u.*, t.status as institution_status FROM institution_users u JOIN institutions t ON u.institution_id = t.id WHERE u.id = ?',
        [decoded.userId]
      );

      if (users.length === 0 || users[0].status !== 'active' || users[0].institution_status !== 'active') {
        throw new Error('Invalid token');
      }

      const user = users[0];
      
      // Generate new token with updated session timestamp
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
      throw new Error('Invalid or expired token');
    }
  }

  async createUser(institutionId, userData, createdBy) {
    const { 
      email, mobile, password, firstName, lastName, address, city, state, country, 
      postalCode, dateOfBirth, gender, department, designation,
      role = 'user', permissions = {}, warehouseAccess = [] 
    } = userData;

    // Check if user already exists (email is globally unique)
    const existingUser = await db.query(
      'SELECT id FROM institution_users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Merge default role permissions with custom permissions
    const defaultPermissions = ROLE_PERMISSIONS[role] || {};
    const finalPermissions = { ...defaultPermissions, ...permissions };

    await db.query(
      `INSERT INTO institution_users (id, institution_id, email, mobile, password_hash, first_name, last_name, 
       address, city, state, country, postal_code, date_of_birth, gender, department, designation,
       role, permissions, warehouse_access, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, institutionId, email, mobile || null, passwordHash, firstName, lastName,
       address || null, city || null, state || null, country || null, postalCode || null, 
       dateOfBirth || null, gender || null, department || null, designation || null,
       role, JSON.stringify(finalPermissions), JSON.stringify(warehouseAccess)]
    );

    logger.info('User created', { userId, institutionId, email, createdBy });
    return userId;
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

  async generateTempAccess(institutionId, targetUserId, adminUserId, expiresInHours = 24) {
    // Generate random temp password
    const tempPassword = Math.random().toString(36).slice(-12);
    const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));

    // Store temp access token
    await db.query(
      `INSERT INTO temp_access_tokens (id, institution_id, target_user_id, created_by, temp_password, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tokenId, institutionId, targetUserId, adminUserId, tempPasswordHash, expiresAt]
    );

    logger.info('Temp access generated', { tokenId, targetUserId, adminUserId, institutionId });
    return { tokenId, tempPassword, expiresAt };
  }

  async loginWithTempAccess(email, tempPassword, institutionId) {
    // Get user and check for active temp access
    const users = await db.query(
      `SELECT u.*, t.status as institution_status,
              ta.id as token_id, ta.temp_password, ta.expires_at, ta.used_at
       FROM institution_users u 
       JOIN institutions t ON u.institution_id = t.id
       LEFT JOIN temp_access_tokens ta ON u.id = ta.target_user_id AND ta.is_active = TRUE
       WHERE u.email = ? AND u.institution_id = ?`,
      [email, institutionId]
    );

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    if (!user.token_id) {
      throw new Error('No active temporary access found');
    }

    if (new Date() > new Date(user.expires_at)) {
      throw new Error('Temporary access has expired');
    }

    if (user.used_at) {
      throw new Error('Temporary access already used');
    }

    // Verify temp password
    const isValidTempPassword = await bcrypt.compare(tempPassword, user.temp_password);
    if (!isValidTempPassword) {
      throw new Error('Invalid temporary password');
    }

    // Mark as used
    await db.query(
      'UPDATE temp_access_tokens SET used_at = NOW(), is_active = FALSE WHERE id = ?',
      [user.token_id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        institutionId: user.institution_id,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        tempAccess: true
      },
      config.jwt.secret,
      { expiresIn: '2h' } // Shorter expiry for temp access
    );

    logger.info('Temp access login successful', { userId: user.id, institutionId: user.institution_id, tokenId: user.token_id });

    return {
      token,
      user: {
        id: user.id,
        institutionId: user.institution_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        tempAccess: true
      }
    };
  }

  async updateUserPermissions(institutionId, userId, permissions, warehouseAccess, role = null) {
    console.log('=== AUTH SERVICE UPDATE START ===');
    console.log('Input params:', { institutionId, userId, permissions, warehouseAccess, role });
    
    // First, let's check if user exists
    const checkUser = await db.query(
      'SELECT id, role, permissions FROM institution_users WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );
    
    console.log('User check result:', checkUser);
    
    if (checkUser.length === 0) {
      throw new Error('User not found');
    }
    
    let query = 'UPDATE institution_users SET permissions = ?, warehouse_access = ?';
    let params = [JSON.stringify(permissions), JSON.stringify(warehouseAccess)];
    
    if (role) {
      query += ', role = ?';
      params.push(role);
    }
    
    query += ', updated_at = NOW() WHERE institution_id = ? AND id = ?';
    params.push(institutionId, userId);
    
    console.log('Final query:', query);
    console.log('Final params:', params);
    
    const result = await db.query(query, params);
    
    console.log('Update result:', result);
    
    // Verify the update
    const verifyUpdate = await db.query(
      'SELECT id, role, permissions FROM institution_users WHERE institution_id = ? AND id = ?',
      [institutionId, userId]
    );
    
    console.log('Verification result:', verifyUpdate);
    
    logger.info('User permissions updated', { 
      userId, 
      institutionId, 
      role, 
      affectedRows: result.affectedRows,
      query,
      params 
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

    // Only prevent deactivating admin users
    if (users[0].role === 'admin' && status === 'inactive') {
      throw new Error('Admin users cannot be deactivated');
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
      `SELECT id, email, first_name, last_name, role, permissions, warehouse_access, status, last_login, created_at
       FROM institution_users 
       WHERE institution_id = ? 
       ORDER BY created_at DESC`,
      [institutionId]
    );
  }

  async getInstitutionByEmail(subdomain) {
    const institutions = await db.query(
      'SELECT * FROM institutions WHERE name = ? AND status = "active"',
      [subdomain]
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

  async extendSession(userId, institutionId) {
    // Verify user is still active
    const users = await db.query(
      'SELECT u.*, t.status as institution_status FROM institution_users u JOIN institutions t ON u.institution_id = t.id WHERE u.id = ? AND u.institution_id = ?',
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
}

module.exports = new AuthService();