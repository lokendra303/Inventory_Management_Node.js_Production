const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class UniversalAuth {
  constructor(config) {
    this.config = {
      jwt: {
        secret: config.jwtSecret || 'your-secret-key',
        expiresIn: config.jwtExpiresIn || '24h'
      },
      database: config.database, // Database connection
      logger: config.logger || console,
      sessionTimeout: config.sessionTimeout || 15 * 60 * 1000, // 15 minutes
      ...config
    };
    
    if (!this.config.database) {
      throw new Error('Database connection is required');
    }
  }

  // Create new tenant with admin user
  async createTenant(tenantData) {
    const { 
      name, adminEmail, adminPassword, adminFirstName, adminLastName,
      adminMobile, adminAddress, adminCity, adminState, adminCountry, 
      adminPostalCode, adminDateOfBirth, adminGender, adminDepartment, adminDesignation 
    } = tenantData;
    
    // Check if email already exists
    const existingUser = await this.config.database.query(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );

    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }
    
    const tenantId = uuidv4();
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Use transaction if available
    if (this.config.database.transaction) {
      await this.config.database.transaction(async (connection) => {
        await this._createTenantWithUser(connection, tenantId, userId, name, adminEmail, passwordHash, {
          adminMobile, adminFirstName, adminLastName, adminAddress, adminCity, 
          adminState, adminCountry, adminPostalCode, adminDateOfBirth, adminGender, 
          adminDepartment, adminDesignation
        });
      });
    } else {
      await this._createTenantWithUser(this.config.database, tenantId, userId, name, adminEmail, passwordHash, {
        adminMobile, adminFirstName, adminLastName, adminAddress, adminCity, 
        adminState, adminCountry, adminPostalCode, adminDateOfBirth, adminGender, 
        adminDepartment, adminDesignation
      });
    }

    this.config.logger.info('Tenant created', { tenantId, adminEmail });
    return { tenantId, userId };
  }

  async _createTenantWithUser(connection, tenantId, userId, name, adminEmail, passwordHash, userData) {
    // Create tenant
    await connection.execute(
      `INSERT INTO tenants (id, name, plan, status, settings) 
       VALUES (?, ?, 'starter', 'active', '{}')`,
      [tenantId, name]
    );

    // Create admin user
    await connection.execute(
      `INSERT INTO users (id, tenant_id, email, mobile, password_hash, first_name, last_name, 
       address, city, state, country, postal_code, date_of_birth, gender, department, designation, 
       role, permissions, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', '{\"all\": true}', 'active')`,
      [userId, tenantId, adminEmail, userData.adminMobile || null, passwordHash, 
       userData.adminFirstName, userData.adminLastName, userData.adminAddress || null, 
       userData.adminCity || null, userData.adminState || null, userData.adminCountry || null, 
       userData.adminPostalCode || null, userData.adminDateOfBirth || null, 
       userData.adminGender || null, userData.adminDepartment || null, userData.adminDesignation || null]
    );
  }

  // Authenticate user
  async authenticateUser(email, password, tenantId = null) {
    let query = 'SELECT u.*, t.status as tenant_status FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = ?';
    let params = [email];

    if (tenantId) {
      query += ' AND u.tenant_id = ?';
      params.push(tenantId);
    }

    const users = await this.config.database.query(query, params);

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    if (user.status !== 'active') {
      throw new Error('User account is inactive');
    }

    if (user.tenant_status !== 'active') {
      throw new Error('Tenant account is suspended');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.config.database.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate JWT token
    const sessionTimestamp = Date.now();
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || [],
        sessionTimestamp
      },
      this.config.jwt.secret,
      { expiresIn: this.config.jwt.expiresIn }
    );

    this.config.logger.info('User authenticated', { userId: user.id, tenantId: user.tenant_id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
        warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || []
      }
    };
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret);
      
      // Check session timeout
      if (decoded.sessionTimestamp) {
        const sessionAge = Date.now() - decoded.sessionTimestamp;
        if (sessionAge > this.config.sessionTimeout) {
          throw new Error('Session expired due to inactivity');
        }
      }
      
      // Verify user still exists and is active
      const users = await this.config.database.query(
        'SELECT u.*, t.status as tenant_status FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = ?',
        [decoded.userId]
      );

      if (users.length === 0 || users[0].status !== 'active' || users[0].tenant_status !== 'active') {
        throw new Error('Invalid token');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Create new user
  async createUser(tenantId, userData) {
    const { 
      email, mobile, password, firstName, lastName, address, city, state, country, 
      postalCode, dateOfBirth, gender, department, designation,
      role = 'user', permissions = {}, warehouseAccess = [] 
    } = userData;

    // Check if user already exists
    const existingUser = await this.config.database.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      throw new Error('Email already registered');
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await this.config.database.query(
      `INSERT INTO users (id, tenant_id, email, mobile, password_hash, first_name, last_name, 
       address, city, state, country, postal_code, date_of_birth, gender, department, designation,
       role, permissions, warehouse_access, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, tenantId, email, mobile || null, passwordHash, firstName, lastName,
       address || null, city || null, state || null, country || null, postalCode || null, 
       dateOfBirth || null, gender || null, department || null, designation || null,
       role, JSON.stringify(permissions), JSON.stringify(warehouseAccess)]
    );

    this.config.logger.info('User created', { userId, tenantId, email });
    return userId;
  }

  // Get tenant users
  async getTenantUsers(tenantId, limit = 50, offset = 0) {
    return await this.config.database.query(
      `SELECT id, email, first_name, last_name, role, permissions, warehouse_access, status, last_login, created_at
       FROM users 
       WHERE tenant_id = ? 
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );
  }

  // Update user permissions
  async updateUserPermissions(tenantId, userId, permissions, warehouseAccess, role = null) {
    let query = 'UPDATE users SET permissions = ?, warehouse_access = ?';
    let params = [JSON.stringify(permissions), JSON.stringify(warehouseAccess)];
    
    if (role) {
      query += ', role = ?';
      params.push(role);
    }
    
    query += ', updated_at = NOW() WHERE tenant_id = ? AND id = ?';
    params.push(tenantId, userId);
    
    const result = await this.config.database.query(query, params);
    
    if (result.affectedRows === 0) {
      throw new Error('User not found or no changes made');
    }

    this.config.logger.info('User permissions updated', { userId, tenantId, role });
  }

  // Change password
  async changePassword(tenantId, userId, currentPassword, newPassword) {
    const users = await this.config.database.query(
      'SELECT password_hash FROM users WHERE tenant_id = ? AND id = ?',
      [tenantId, userId]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.config.database.query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE tenant_id = ? AND id = ?',
      [newPasswordHash, tenantId, userId]
    );

    this.config.logger.info('User password changed', { userId, tenantId });
  }

  // Refresh token
  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret);
      
      const users = await this.config.database.query(
        'SELECT u.*, t.status as tenant_status FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = ?',
        [decoded.userId]
      );

      if (users.length === 0 || users[0].status !== 'active' || users[0].tenant_status !== 'active') {
        throw new Error('Invalid token');
      }

      const user = users[0];
      
      const sessionTimestamp = Date.now();
      const newToken = jwt.sign(
        {
          userId: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          role: user.role,
          permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '{}') : user.permissions || {},
          warehouseAccess: typeof user.warehouse_access === 'string' ? JSON.parse(user.warehouse_access || '[]') : user.warehouse_access || [],
          sessionTimestamp
        },
        this.config.jwt.secret,
        { expiresIn: this.config.jwt.expiresIn }
      );

      return {
        token: newToken,
        user: {
          id: user.id,
          tenantId: user.tenant_id,
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
}

module.exports = UniversalAuth;