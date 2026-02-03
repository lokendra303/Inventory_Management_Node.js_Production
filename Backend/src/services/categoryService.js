const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class CategoryService {
  async createCategory(institutionId, categoryData, userId) {
    const { name, description, parentId = null, sortOrder = 0 } = categoryData;
    
    const categoryId = uuidv4();
    let level = 0;
    
    // Calculate level if parent exists
    if (parentId) {
      const parent = await db.query(
        'SELECT level FROM categories WHERE institution_id = ? AND id = ?',
        [institutionId, parentId]
      );
      if (parent.length > 0) {
        level = parent[0].level + 1;
      }
    }

    await db.query(
      `INSERT INTO categories (id, institution_id, name, description, parent_id, level, sort_order, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryId, institutionId, name, description || null, parentId, level, sortOrder, userId]
    );

    logger.info('Category created', { categoryId, institutionId, name, userId });
    return categoryId;
  }

  async getCategories(institutionId, filters = {}) {
    let query = `
      SELECT c.*, p.name as parent_name,
             (SELECT COUNT(*) FROM categories WHERE parent_id = c.id AND institution_id = ?) as child_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE c.institution_id = ? AND c.is_active = TRUE
    `;
    const params = [institutionId, institutionId];

    if (filters.parentId === null) {
      query += ' AND c.parent_id IS NULL';
    } else if (filters.parentId) {
      query += ' AND c.parent_id = ?';
      params.push(filters.parentId);
    }

    query += ' ORDER BY c.level, c.sort_order, c.name';

    return await db.query(query, params);
  }

  async updateCategory(institutionId, categoryId, updateData, userId) {
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
          'SELECT level FROM categories WHERE institution_id = ? AND id = ?',
          [institutionId, parentId]
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
    updateValues.push(institutionId, categoryId);

    const result = await db.query(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE institution_id = ? AND id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      throw new Error('Category not found');
    }

    logger.info('Category updated', { categoryId, institutionId, userId });
  }

  async deleteCategory(institutionId, categoryId, userId) {
    // Check if category has children
    const children = await db.query(
      'SELECT COUNT(*) as count FROM categories WHERE institution_id = ? AND parent_id = ?',
      [institutionId, categoryId]
    );

    if (children[0].count > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    // Check if category is used by items
    const items = await db.query(
      'SELECT COUNT(*) as count FROM items WHERE institution_id = ? AND category = (SELECT name FROM categories WHERE id = ?)',
      [institutionId, categoryId]
    );

    if (items[0].count > 0) {
      throw new Error('Cannot delete category that is used by items');
    }

    // Soft delete
    const result = await db.query(
      'UPDATE categories SET is_active = FALSE, updated_at = NOW() WHERE institution_id = ? AND id = ?',
      [institutionId, categoryId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Category not found');
    }

    logger.info('Category deleted', { categoryId, institutionId, userId });
  }

  async getCategoryTree(institutionId) {
    const categories = await this.getCategories(institutionId);
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