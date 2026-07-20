const { v4: uuidv4 } = require('uuid');
const database = require('../../database/connection');

class UnitsController {
  async create(req, res) {
    try {
      const { name, symbol, type, base_unit_id, conversion_factor } = req.body;
      const institution_id = req.user.institutionId;
      const normalizedType = type || 'other';
      const normalizedBaseUnitId = base_unit_id ?? null;
      const normalizedConversionFactor = conversion_factor ?? 1;

      if (!name || !symbol) {
        return res.status(400).json({ error: 'Name and symbol are required' });
      }

      const id = uuidv4();
      const safeName = String(name).trim();
      const safeSymbol = String(symbol).trim().slice(0, 20);
      
      await database.query(`
        INSERT INTO units (id, institution_id, name, symbol, type, base_unit_id, conversion_factor) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, institution_id, safeName, safeSymbol, normalizedType, normalizedBaseUnitId, normalizedConversionFactor]);

      const unit = await database.query('SELECT * FROM units WHERE id = ?', [id]);
      res.status(201).json(unit[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Unit name or symbol already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const institution_id = req.user.institutionId;
      const { type, status = 'active' } = req.query;

      console.log('Fetching units for institution:', institution_id);

      let query = 'SELECT * FROM units WHERE institution_id = ? AND status = ?';
      let params = [institution_id, status];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      query += ' ORDER BY type, name';

      const units = await database.query(query, params);
      console.log('Found units:', units.length);
      res.json(units);
    } catch (error) {
      console.error('Error in getAll units:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;

      const unit = await database.query(
        'SELECT * FROM units WHERE id = ? AND institution_id = ?',
        [id, institution_id]
      );

      if (unit.length === 0) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      res.json(unit[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;
      const { name, symbol, type, base_unit_id, conversion_factor, status } = req.body;

      if (!name || !symbol) {
        return res.status(400).json({ error: 'Name and symbol are required' });
      }

      const existing = await database.query(
        'SELECT * FROM units WHERE id = ? AND institution_id = ?',
        [id, institution_id]
      );
      if (!existing.length) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      const current = existing[0];
      const safeName = String(name).trim();
      const safeSymbol = String(symbol).trim().slice(0, 20);
      const normalizedType = type || current.type || 'other';
      const normalizedBaseUnitId = base_unit_id !== undefined ? (base_unit_id ?? null) : current.base_unit_id;
      const normalizedConversionFactor = conversion_factor ?? current.conversion_factor ?? 1;
      const normalizedStatus = status || current.status || 'active';

      await database.query(`
        UPDATE units SET name = ?, symbol = ?, type = ?, base_unit_id = ?, 
               conversion_factor = ?, status = ?
        WHERE id = ? AND institution_id = ?
      `, [safeName, safeSymbol, normalizedType, normalizedBaseUnitId, normalizedConversionFactor, normalizedStatus, id, institution_id]);

      const unit = await database.query('SELECT * FROM units WHERE id = ?', [id]);
      res.json(unit[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Unit name or symbol already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;

      const result = await database.query(
        'DELETE FROM units WHERE id = ? AND institution_id = ?',
        [id, institution_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new UnitsController();
