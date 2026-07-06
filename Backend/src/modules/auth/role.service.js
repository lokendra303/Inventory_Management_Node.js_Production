const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const { ROLE_PERMISSIONS } = require('../../constants/permissions');
const authService = require('./auth.service');

const SYSTEM_ROLE_IDS = ['admin', 'manager', 'user'];

class RoleService {
  async createRole(institutionId, name, permissions) {
    // Check if role already exists
    const existingRole = await db.query(
      'SELECT id FROM roles WHERE institution_id = ? AND name = ?',
      [institutionId, name]
    );

    if (existingRole.length > 0) {
      throw new Error('Role already exists');
    }

    const roleId = uuidv4();
    
    await db.query(
      'INSERT INTO roles (id, institution_id, name, permissions, created_at) VALUES (?, ?, ?, ?, NOW())',
      [roleId, institutionId, name, JSON.stringify(permissions)]
    );

    logger.info('Role created', { roleId, institutionId, name });
    return roleId;
  }

  async getinstitutionRoles(institutionId) {
    // Check if roles table exists, if not create it
    try {
      await db.query('SELECT 1 FROM roles LIMIT 1');
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        // Create roles table
        await db.query(`
          CREATE TABLE roles (
            id VARCHAR(36) PRIMARY KEY,
            institution_id VARCHAR(36) NOT NULL,
            name VARCHAR(100) NOT NULL,
            permissions JSON NOT NULL,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
            UNIQUE KEY unique_institution_role (institution_id, name),
            INDEX idx_institution (institution_id)
          )
        `);
      }
    }

    // Check if the foreign key constraint is correct, if not fix it
    try {
      const constraints = await db.query(`
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'roles' 
        AND COLUMN_NAME = 'institution_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      
      if (constraints.length > 0 && constraints[0].REFERENCED_TABLE_NAME === 'tenants') {
        // Drop the old constraint and add the correct one
        await db.query(`ALTER TABLE roles DROP FOREIGN KEY ${constraints[0].CONSTRAINT_NAME}`);
        await db.query(`ALTER TABLE roles ADD CONSTRAINT roles_institution_fk FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE`);
        logger.info('Fixed roles table foreign key constraint');
      }
    } catch (error) {
      logger.warn('Could not check/fix foreign key constraint', { error: error.message });
    }

    const roles = await db.query(
      'SELECT id, name, permissions, status, created_at FROM roles WHERE institution_id = ? ORDER BY name',
      [institutionId]
    );

    const parsed = roles.map(role => ({
      ...role,
      permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions,
      isSystem: SYSTEM_ROLE_IDS.includes(role.id) || SYSTEM_ROLE_IDS.includes(role.name)
    }));

    const existingKeys = new Set();
    parsed.forEach((role) => {
      existingKeys.add(role.id);
      existingKeys.add(role.name);
    });

    for (const systemRoleId of SYSTEM_ROLE_IDS) {
      if (!existingKeys.has(systemRoleId)) {
        parsed.push({
          id: systemRoleId,
          name: systemRoleId,
          permissions: ROLE_PERMISSIONS[systemRoleId] || {},
          status: 'active',
          created_at: null,
          isSystem: true
        });
      }
    }

    return parsed.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  async updateRole(institutionId, roleId, name, permissions) {
    if (!roleId) {
      throw new Error('Role ID is required');
    }
    
    // Only prevent updating admin role
    if (roleId === 'admin') {
      throw new Error('Cannot update admin role');
    }

    const existingRole = await db.query(
      'SELECT name FROM roles WHERE id = ? AND institution_id = ?',
      [roleId, institutionId]
    );
    const previousName = existingRole[0]?.name;

    // Ensure system roles exist in database first
    if (['manager', 'user'].includes(roleId)) {
      const existing = await db.query(
        'SELECT id FROM roles WHERE id = ? AND institution_id = ?',
        [roleId, institutionId]
      );
      
      if (existing.length === 0) {
        await db.query(
          'INSERT INTO roles (id, institution_id, name, permissions, status, created_at) VALUES (?, ?, ?, ?, \'active\', NOW())',
          [roleId, institutionId, name, JSON.stringify(permissions)]
        );
        
        logger.info('System role created', { roleId, institutionId, name });
      } else {
        const result = await db.query(
          'UPDATE roles SET name = ?, permissions = ?, updated_at = NOW() WHERE id = ? AND institution_id = ?',
          [name, JSON.stringify(permissions), roleId, institutionId]
        );

        if (result.affectedRows === 0) {
          throw new Error('Role not found');
        }

        logger.info('Role updated', { roleId, institutionId, name });
      }
    } else {
      const result = await db.query(
        'UPDATE roles SET name = ?, permissions = ?, updated_at = NOW() WHERE id = ? AND institution_id = ?',
        [name, JSON.stringify(permissions), roleId, institutionId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Role not found');
      }

      logger.info('Role updated', { roleId, institutionId, name });
    }

    if (previousName && previousName !== name) {
      await db.query(
        'UPDATE institution_users SET role = ? WHERE institution_id = ? AND role = ?',
        [name, institutionId, previousName]
      );
    }

    await authService.clearUserPermissionSnapshotsForRole(institutionId, name);
  }

  async toggleRoleStatus(institutionId, roleId) {
    if (!roleId) {
      throw new Error('Role ID is required');
    }
    
    if (roleId === 'admin') {
      throw new Error('Cannot disable admin role');
    }

    // Get current status
    const roles = await db.query(
      'SELECT status FROM roles WHERE id = ? AND institution_id = ?',
      [roleId, institutionId]
    );

    if (roles.length === 0) {
      throw new Error(`Role '${roleId}' not found in database. Please create the role first.`);
    }

    const newStatus = roles[0].status === 'active' ? 'inactive' : 'active';
    
    await db.query(
      'UPDATE roles SET status = ?, updated_at = NOW() WHERE id = ? AND institution_id = ?',
      [newStatus, roleId, institutionId]
    );

    logger.info('Role status toggled', { roleId, institutionId, newStatus });
    return newStatus;
  }
}

module.exports = new RoleService();