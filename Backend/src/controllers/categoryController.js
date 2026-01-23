const categoryService = require('../services/categoryService');
const logger = require('../utils/logger');

class CategoryController {
  async createCategory(req, res) {
    try {
      const categoryId = await categoryService.createCategory(
        req.tenantId,
        req.body,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: { categoryId }
      });
    } catch (error) {
      logger.error('Category creation failed', { 
        error: error.message, 
        tenantId: req.tenantId,
        userId: req.user.userId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getCategories(req, res) {
    try {
      const filters = {
        parentId: req.query.parentId
      };
      
      const categories = await categoryService.getCategories(req.tenantId, filters);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Failed to get categories', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getCategoryTree(req, res) {
    try {
      const tree = await categoryService.getCategoryTree(req.tenantId);
      
      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      logger.error('Failed to get category tree', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getCategory(req, res) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(req.tenantId, id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }
      
      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error('Failed to get category', { error: error.message, tenantId: req.tenantId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async updateCategory(req, res) {
    try {
      const { categoryId } = req.params;
      await categoryService.updateCategory(req.tenantId, categoryId, req.body, req.user.userId);
      
      res.json({
        success: true,
        message: 'Category updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update category', { 
        error: error.message, 
        tenantId: req.tenantId,
        categoryId: req.params.categoryId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteCategory(req, res) {
    try {
      const { categoryId } = req.params;
      await categoryService.deleteCategory(req.tenantId, categoryId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete category', { 
        error: error.message, 
        tenantId: req.tenantId,
        categoryId: req.params.categoryId 
      });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new CategoryController();