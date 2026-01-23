const roleService = require('../services/roleService');
const logger = require('../utils/logger');

class RoleController {
  async createRole(req, res) {
    try {
      const { name, permissions } = req.body;
      const roleId = await roleService.createRole(req.tenantId, name, permissions);
      
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: { roleId }
      });
    } catch (error) {
      logger.error('Role creation failed', { error: error.message, tenantId: req.tenantId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getRoles(req, res) {
    try {
      const roles = await roleService.getTenantRoles(req.tenantId);
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      logger.error('Failed to get roles', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateRole(req, res) {
    try {
      const { roleId } = req.params;
      const { name, permissions } = req.body;
      
      await roleService.updateRole(req.tenantId, roleId, name, permissions);
      
      res.json({
        success: true,
        message: 'Role updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update role', { error: error.message, tenantId: req.tenantId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async toggleRoleStatus(req, res) {
    try {
      const { roleId } = req.params;
      
      const newStatus = await roleService.toggleRoleStatus(req.tenantId, roleId);
      
      res.json({
        success: true,
        message: `Role ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
        data: { status: newStatus }
      });
    } catch (error) {
      logger.error('Failed to toggle role status', { error: error.message, tenantId: req.tenantId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new RoleController();