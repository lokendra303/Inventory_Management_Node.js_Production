const { v4: uuidv4 } = require('uuid');
const database = require('../../database/connection');

class ManufacturerController {
  async create(req, res) {
    try {
      const { name, code, description, contact_person, email, phone, website, address, country } = req.body;
      const institution_id = req.user.institutionId;

      if (!name) {
        return res.status(400).json({ error: 'Manufacturer name is required' });
      }

      const id = uuidv4();
      
      await database.query(`
        INSERT INTO manufacturers (
          id, institution_id, name, code, description, contact_person, 
          email, phone, website, address, country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, institution_id, name, code || null, description || null, contact_person || null, 
           email || null, phone || null, website || null, address || null, country || null]);

      const manufacturer = await database.query(
        'SELECT * FROM manufacturers WHERE id = ?', [id]
      );

      res.status(201).json(manufacturer[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Manufacturer name or code already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const institution_id = req.user.institutionId;

      console.log('Fetching manufacturers for institution:', institution_id);

      const manufacturers = await database.query(`
        SELECT * FROM manufacturers 
        WHERE institution_id = ?
        ORDER BY name
      `, [institution_id]);

      console.log('Found manufacturers:', manufacturers.length);
      res.json(manufacturers);
    } catch (error) {
      console.error('Error in getAll manufacturers:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;

      const manufacturer = await database.query(
        'SELECT * FROM manufacturers WHERE id = ? AND institution_id = ?',
        [id, institution_id]
      );

      if (manufacturer.length === 0) {
        return res.status(404).json({ error: 'Manufacturer not found' });
      }

      res.json(manufacturer[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;
      const { name, code, description, contact_person, email, phone, website, address, country, status } = req.body;

      const result = await database.query(`
        UPDATE manufacturers SET 
          name = ?, code = ?, description = ?, contact_person = ?, 
          email = ?, phone = ?, website = ?, address = ?, country = ?, status = ?
        WHERE id = ? AND institution_id = ?
      `, [name, code || null, description || null, contact_person || null, 
          email || null, phone || null, website || null, address || null, country || null, status || 'active', id, institution_id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Manufacturer not found' });
      }

      const manufacturer = await database.query(
        'SELECT * FROM manufacturers WHERE id = ?', [id]
      );

      res.json(manufacturer[0]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Manufacturer name or code already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const institution_id = req.user.institutionId;

      const result = await database.query(
        'DELETE FROM manufacturers WHERE id = ? AND institution_id = ?',
        [id, institution_id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Manufacturer not found' });
      }

      res.json({ message: 'Manufacturer deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ManufacturerController();
