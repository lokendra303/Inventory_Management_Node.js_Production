const { v4: uuidv4 } = require('uuid');
const database = require('../../database/connection');

class BrandController {
  async create(req, res) {
    try {
      const { name, code, description, manufacturer_id, logo_url } = req.body;
      const institution_id = req.user.institutionId;

      if (!name) {
        return res.status(400).json({ error: 'Brand name is required' });
      }

      const id = uuidv4();
      
      await database.query(`
        INSERT INTO brands (
          id, institution_id, manufacturer_id, name, code, description, logo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, institution_id, manufacturer_id || null, name, code || null, description || null, logo_url || null]);

      const brand = await database.query(`
        SELECT b.*, m.name as manufacturer_name 
        FROM brands b
        LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
        WHERE b.id = ?
      `, [id]);

      res.status(201).json(brand[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Brand name or code already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const institution_id = req.user.institutionId;
      const { status = 'active' } = req.query;

      console.log('Fetching brands for institution:', institution_id);

      let query = `
        SELECT b.*, m.name as manufacturer_name 
        FROM brands b
        LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
        WHERE b.institution_id = ? AND b.status = ?
        ORDER BY CASE WHEN b.status = 'active' THEN 0 ELSE 1 END, b.name
      `;
      let params = [institution_id, status];

      if (req.query.manufacturer_id) {
        query = query.replace('ORDER BY', 'AND b.manufacturer_id = ? ORDER BY');
        params.splice(2, 0, req.query.manufacturer_id);
      }

      const brands = await database.query(query, params);
      console.log('Found brands:', brands.length);
      res.json(brands);
    } catch (error) {
      console.error('Error in getAll brands:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;

      const brand = await database.query(`
        SELECT b.*, m.name as manufacturer_name 
        FROM brands b
        LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
        WHERE b.id = ? AND b.institution_id = ?
      `, [id, institution_id]);

      if (brand.length === 0) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      res.json(brand[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;
      const { name, code, description, manufacturer_id, logo_url, status } = req.body;

      const result = await database.query(`
        UPDATE brands SET 
          name = ?, code = ?, description = ?, manufacturer_id = ?, logo_url = ?, status = ?
        WHERE id = ? AND institution_id = ?
      `, [name, code || null, description || null, manufacturer_id || null, logo_url || null, status || 'active', id, institution_id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const brand = await database.query(`
        SELECT b.*, m.name as manufacturer_name 
        FROM brands b
        LEFT JOIN manufacturers m ON b.manufacturer_id = m.id
        WHERE b.id = ?
      `, [id]);

      res.json(brand[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Brand name or code already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;

      const result = await database.query(
        'DELETE FROM brands WHERE id = ? AND institution_id = ?',
        [id, institution_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      res.json({ message: 'Brand deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BrandController();
