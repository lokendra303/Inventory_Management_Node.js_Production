const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

const DEFAULT_TAX_TYPES = ['GST','VAT','TDS','TCS','IGST','CGST','SGST'];

async function seedTaxTypes(institutionId) {
  const existing = await db.query(
    'SELECT COUNT(*) as c FROM tax_types WHERE institution_id=?', [institutionId]
  );
  if (existing[0].c > 0) return;
  for (const name of DEFAULT_TAX_TYPES) {
    await db.query(
      'INSERT IGNORE INTO tax_types (id, institution_id, name) VALUES (UUID(), ?, ?)',
      [institutionId, name]
    );
  }
}

class TaxService {
  // ── Tax Types ────────────────────────────────────────────────
  async getTaxTypes(institutionId) {
    await seedTaxTypes(institutionId);
    return db.query(
      `SELECT * FROM tax_types WHERE institution_id=? AND status='active' ORDER BY name`,
      [institutionId]
    );
  }

  async createTaxType(institutionId, name) {
    const trimmed = name?.trim();
    if (!trimmed) throw new Error('Tax type name is required');
    await db.query(
      'INSERT IGNORE INTO tax_types (id, institution_id, name) VALUES (UUID(), ?, ?)',
      [institutionId, trimmed]
    );
    return this.getTaxTypes(institutionId);
  }

  async deleteTaxType(institutionId, typeId) {
    await db.query(
      `UPDATE tax_types SET status='inactive' WHERE institution_id=? AND id=?`,
      [institutionId, typeId]
    );
    return true;
  }

  // ── Tax Groups ──────────────────────────────────────────────
  async getTaxGroups(institutionId) {
    return db.query(
      `SELECT tg.*, COUNT(tr.id) as rate_count
       FROM tax_groups tg
       LEFT JOIN tax_rates tr ON tr.tax_group_id = tg.id AND tr.status = 'active'
       WHERE tg.institution_id = ? AND tg.status = 'active'
       GROUP BY tg.id ORDER BY tg.name`,
      [institutionId]
    );
  }

  async createTaxGroup(institutionId, { name, description }) {
    const id = uuidv4();
    await db.query(
      'INSERT INTO tax_groups (id, institution_id, name, description) VALUES (?, ?, ?, ?)',
      [id, institutionId, name, description || null]
    );
    logger.info('Tax group created', { id, institutionId, name });
    return id;
  }

  async updateTaxGroup(institutionId, groupId, { name, description, status }) {
    const fields = [], vals = [];
    if (name !== undefined)        { fields.push('name=?');        vals.push(name); }
    if (description !== undefined) { fields.push('description=?'); vals.push(description); }
    if (status !== undefined)      { fields.push('status=?');      vals.push(status); }
    if (!fields.length) throw new Error('Nothing to update');
    fields.push('updated_at=NOW()');
    vals.push(institutionId, groupId);
    await db.query(`UPDATE tax_groups SET ${fields.join(',')} WHERE institution_id=? AND id=?`, vals);
    return true;
  }

  async deleteTaxGroup(institutionId, groupId) {
    await db.query('UPDATE tax_groups SET status="inactive" WHERE institution_id=? AND id=?', [institutionId, groupId]);
    return true;
  }

  // ── Tax Rates ────────────────────────────────────────────────
  async getTaxRates(institutionId, groupId = null) {
    let q = `SELECT tr.*, tg.name as group_name
             FROM tax_rates tr
             LEFT JOIN tax_groups tg ON tr.tax_group_id = tg.id
             WHERE tr.institution_id = ? AND tr.status = 'active'`;
    const p = [institutionId];
    if (groupId) { q += ' AND tr.tax_group_id = ?'; p.push(groupId); }
    q += ' ORDER BY tr.rate';
    return db.query(q, p);
  }

  async createTaxRate(institutionId, { name, rate, taxType, taxGroupId, isCompound, isInclusive }) {
    const id = uuidv4();
    await db.query(
      `INSERT INTO tax_rates (id, institution_id, tax_group_id, name, rate, tax_type, is_compound, is_inclusive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, institutionId, taxGroupId || null, name, rate, taxType || 'custom', isCompound ? 1 : 0, isInclusive ? 1 : 0]
    );
    logger.info('Tax rate created', { id, institutionId, name, rate });
    return id;
  }

  async updateTaxRate(institutionId, rateId, data) {
    const fields = [], vals = [];
    const map = { name: 'name', rate: 'rate', taxType: 'tax_type', taxGroupId: 'tax_group_id',
                  isCompound: 'is_compound', isInclusive: 'is_inclusive', status: 'status' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { fields.push(`${col}=?`); vals.push(data[k]); }
    }
    if (!fields.length) throw new Error('Nothing to update');
    fields.push('updated_at=NOW()');
    vals.push(institutionId, rateId);
    await db.query(`UPDATE tax_rates SET ${fields.join(',')} WHERE institution_id=? AND id=?`, vals);
    return true;
  }

  async deleteTaxRate(institutionId, rateId) {
    await db.query('UPDATE tax_rates SET status="inactive" WHERE institution_id=? AND id=?', [institutionId, rateId]);
    return true;
  }

  async getTaxRateById(institutionId, rateId) {
    const rows = await db.query(
      `SELECT tr.*, tg.name as group_name FROM tax_rates tr
       LEFT JOIN tax_groups tg ON tr.tax_group_id = tg.id
       WHERE tr.institution_id=? AND tr.id=? AND tr.status='active'`,
      [institutionId, rateId]
    );
    if (!rows.length) throw new Error('Tax rate not found');
    return rows[0];
  }
}

module.exports = new TaxService();
