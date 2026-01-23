const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class RoleService {
  async createRole(tenantId, name, permissions) {
    // Check if role already exists
    const existingRole = await db.query(
      'SELECT id FROM roles WHERE tenant_id = ? AND name = ?',
      [tenantId, name]
    );

    if (existingRole.length > 0) {
      throw new Error('Role already exists');
    }

    const roleId = uuidv4();
    
    await db.query(
      'INSERT INTO roles (id, tenant_id, name, permissions, created_at) VALUES (?, ?, ?, ?, NOW())',
      [roleId, tenantId, name, JSON.stringify(permissions)]
    );

    logger.info('Role created', { roleId, tenantId, name });
    return roleId;
  }

  async getTenantRoles(tenantId) {
    // Check if roles table exists, if not create it
    try {
      await db.query('SELECT 1 FROM roles LIMIT 1');
    } catch (error) {
      if (error.message.includes("doesn't exist")) {
        // Create roles table
        await db.query(`
          CREATE TABLE roles (
            id VARCHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(36) NOT NULL,
            name VARCHAR(100) NOT NULL,
            permissions JSON NOT NULL,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
            UNIQUE KEY unique_tenant_role (tenant_id, name),
            INDEX idx_tenant (tenant_id)
          )
        `);
      }
    }

    const roles = await db.query(
      'SELECT id, name, permissions, status, created_at FROM roles WHERE tenant_id = ? ORDER BY name',
      [tenantId]
    );

    // Parse permissions for all roles
    return roles.map(role => ({
      ...role,
      permissions: typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions,
      isSystem: ['admin', 'manager', 'user'].includes(role.id)
    }));
  }

  async updateRole(tenantId, roleId, name, permissions) {
    // Only prevent updating admin role
    if (roleId === 'admin') {
      throw new Error('Cannot update admin role');
    }

    // Ensure system roles exist in database first
    if (['manager', 'user'].includes(roleId)) {
      const existing = await db.query(
        'SELECT id FROM roles WHERE id = ? AND tenant_id = ?',
        [roleId, tenantId]
      );
      
      if (existing.length === 0) {
        // Create system role first
        const defaultPermissions = roleId === 'manager' ? {
          inventory_view: true, 
          inventory_receive: true, 
          inventory_adjust: true, 
          item_management: true, 
          item_view: true,
          warehouse_management: true, 
          warehouse_view: true,
          category_management: true,
          category_view: true,
          purchase_management: true,
          purchase_view: true,
          sales_management: true,
          sales_view: true
        } : {
          inventory_view: true, 
          item_view: true, 
          warehouse_view: true,
          category_view: true,
          purchase_view: true,
          sales_view: true
        };
        
        await db.query(
          'INSERT INTO roles (id, tenant_id, name, permissions, status, created_at) VALUES (?, ?, ?, ?, \'active\', NOW())',
          [roleId, tenantId, name, JSON.stringify(defaultPermissions)]
        );
        
        logger.info('System role created and updated', { roleId, tenantId, name });
        return;
      }
    }

    const result = await db.query(
      'UPDATE roles SET name = ?, permissions = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [name, JSON.stringify(permissions), roleId, tenantId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Role not found');
    }

    logger.info('Role updated', { roleId, tenantId, name });
  }

  async toggleRoleStatus(tenantId, roleId) {
    if (roleId === 'admin') {
      throw new Error('Cannot disable admin role');
    }

    // Get current status
    const roles = await db.query(
      'SELECT status FROM roles WHERE id = ? AND tenant_id = ?',
      [roleId, tenantId]
    );

    if (roles.length === 0) {
      throw new Error(`Role '${roleId}' not found in database. Please create the role first.`);
    }

    const newStatus = roles[0].status === 'active' ? 'inactive' : 'active';
    
    await db.query(
      'UPDATE roles SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [newStatus, roleId, tenantId]
    );

    logger.info('Role status toggled', { roleId, tenantId, newStatus });
    return newStatus;
  }
}

module.exports = new RoleService();