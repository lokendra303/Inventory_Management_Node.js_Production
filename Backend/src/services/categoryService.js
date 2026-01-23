const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class CategoryService {
  async createCategory(tenantId, categoryData, userId) {
    const { name, description, parentId = null, sortOrder = 0 } = categoryData;
    
    const categoryId = uuidv4();
    let level = 0;
    
    // Calculate level if parent exists
    if (parentId) {
      const parent = await db.query(
        'SELECT level FROM categories WHERE tenant_id = ? AND id = ?',
        [tenantId, parentId]
      );
      if (parent.length > 0) {
        level = parent[0].level + 1;
      }
    }

    await db.query(
      `INSERT INTO categories (id, tenant_id, name, description, parent_id, level, sort_order, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryId, tenantId, name, description || null, parentId, level, sortOrder, userId]
    );

    logger.info('Category created', { categoryId, tenantId, name, userId });
    return categoryId;
  }

  async getCategories(tenantId, filters = {}) {
    let query = `
      SELECT c.*, p.name as parent_name,
             (SELECT COUNT(*) FROM categories WHERE parent_id = c.id AND tenant_id = ?) as child_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.tenant_id = ? AND c.is_active = TRUE
    `;
    const params = [tenantId, tenantId];

    if (filters.parentId === null) {
      query += ' AND c.parent_id IS NULL';
    } else if (filters.parentId) {
      query += ' AND c.parent_id = ?';
      params.push(filters.parentId);
    }

    query += ' ORDER BY c.level, c.sort_order, c.name';

    return await db.query(query, params);
  }

  async updateCategory(tenantId, categoryId, updateData, userId) {
    const { name, description, parentId, sortOrder, isActive } = updateData;
    
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (parentId !== undefined) {
      updateFields.push('parent_id = ?');
      updateValues.push(parentId);
      
      // Recalculate level
      let level = 0;
      if (parentId) {
        const parent = await db.query(
          'SELECT level FROM categories WHERE tenant_id = ? AND id = ?',
          [tenantId, parentId]
        );
        if (parent.length > 0) {
          level = parent[0].level + 1;
        }
      }
      updateFields.push('level = ?');
      updateValues.push(level);
    }
    if (sortOrder !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(sortOrder);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(tenantId, categoryId);

    const result = await db.query(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE tenant_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('Category not found');
    }

    logger.info('Category updated', { categoryId, tenantId, userId });
  }

  async deleteCategory(tenantId, categoryId, userId) {
    // Check if category has children
    const children = await db.query(
      'SELECT COUNT(*) as count FROM categories WHERE tenant_id = ? AND parent_id = ?',
      [tenantId, categoryId]
    );

    if (children[0].count > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    // Check if category is used by items
    const items = await db.query(
      'SELECT COUNT(*) as count FROM items WHERE tenant_id = ? AND category = (SELECT name FROM categories WHERE id = ?)',
      [tenantId, categoryId]
    );

    if (items[0].count > 0) {
      throw new Error('Cannot delete category that is used by items');
    }

    // Soft delete
    const result = await db.query(
      'UPDATE categories SET is_active = FALSE, updated_at = NOW() WHERE tenant_id = ? AND id = ?',
      [tenantId, categoryId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Category not found');
    }

    logger.info('Category deleted', { categoryId, tenantId, userId });
  }

  async getCategoryTree(tenantId) {
    const categories = await this.getCategories(tenantId);
    return this.buildTree(categories);
  }

  buildTree(categories, parentId = null) {
    const tree = [];
    
    for (const category of categories) {
      if (category.parent_id === parentId) {
        const children = this.buildTree(categories, category.id);
        if (children.length > 0) {
          category.children = children;
        }
        tree.push(category);
      }
    }
    
    return tree;
  }
}

module.exports = new CategoryService();