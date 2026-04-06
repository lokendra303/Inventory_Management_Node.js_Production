const db = require('../../database/connection');
const logger = require('../../utils/logger');
const CurrencyService = require('../../utils/currencyService');

let tablesEnsured = false;

async function ensureTables() {
  if (tablesEnsured) return;

  // institutions extra columns
  for (const sql of [
    'ALTER TABLE institutions ADD COLUMN exchange_rate DECIMAL(15,6) NOT NULL DEFAULT 1',
    "ALTER TABLE institutions ADD COLUMN base_currency VARCHAR(10) NOT NULL DEFAULT 'USD'"
  ]) {
    try { await db.query(sql); } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) throw e; }
  }

  // currencies master — one row per currency code per institution
  await db.query(`
    CREATE TABLE IF NOT EXISTS currencies (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      code          VARCHAR(10) NOT NULL,
      name          VARCHAR(100) NOT NULL,
      symbol        VARCHAR(10) NOT NULL,
      is_base       TINYINT(1) NOT NULL DEFAULT 0,
      is_active     TINYINT(1) NOT NULL DEFAULT 1,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_inst_code (institution_id, code)
    )
  `);

  // exchange_rates — current rate per pair
  await db.query(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      from_currency  VARCHAR(10) NOT NULL,
      to_currency    VARCHAR(10) NOT NULL,
      rate           DECIMAL(15,6) NOT NULL DEFAULT 1,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_pair (institution_id, from_currency, to_currency)
    )
  `);

  // currency_rate_history — full audit trail of every rate change
  await db.query(`
    CREATE TABLE IF NOT EXISTS currency_rate_history (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      from_currency  VARCHAR(10) NOT NULL,
      to_currency    VARCHAR(10) NOT NULL,
      rate           DECIMAL(15,6) NOT NULL,
      inverse_rate   DECIMAL(15,6) NOT NULL,
      changed_by     VARCHAR(36),
      changed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      note           VARCHAR(255),
      INDEX idx_inst_pair (institution_id, from_currency, to_currency),
      INDEX idx_changed_at (changed_at)
    )
  `);

  tablesEnsured = true;
}

// Seed currencies master for an institution if empty
async function seedCurrencies(institutionId) {
  const existing = await db.query(
    'SELECT COUNT(*) as cnt FROM currencies WHERE institution_id = ?',
    [institutionId]
  );
  if (existing[0].cnt > 0) return;

  const all = CurrencyService.getCurrencies();
  for (const c of all) {
    try {
      await db.query(
        `INSERT IGNORE INTO currencies (institution_id, code, name, symbol, is_base)
         VALUES (?, ?, ?, ?, ?)`,
        [institutionId, c.code, c.name, c.symbol, c.code === 'USD' ? 1 : 0]
      );
    } catch (e) { /* ignore duplicates */ }
  }
}

class SettingsController {
  async getInstitutionSettings(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;

      const institution = await db.query(
        'SELECT currency, currency_symbol, exchange_rate, base_currency FROM institutions WHERE id = ?',
        [institutionId]
      );
      if (institution.length === 0) return res.status(404).json({ error: 'Institution not found' });

      res.json({
        success: true,
        data: {
          currency: institution[0].currency || 'USD',
          currencySymbol: institution[0].currency_symbol || '$',
          exchangeRate: parseFloat(institution[0].exchange_rate) || 1,
          baseCurrency: institution[0].base_currency || 'USD',
          availableCurrencies: CurrencyService.getCurrencies()
        }
      });
    } catch (error) {
      logger.error('Get institution settings error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }

  async updateInstitutionSettings(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;
      const { currency, exchangeRate } = req.body;

      if (!currency) return res.status(400).json({ error: 'Currency is required' });
      const rate = parseFloat(exchangeRate);
      if (isNaN(rate) || rate <= 0) return res.status(400).json({ error: 'Exchange rate must be a positive number' });

      const currencySymbol = CurrencyService.getCurrencySymbol(currency);

      await db.query(
        `UPDATE institutions
         SET currency = ?, currency_symbol = ?, exchange_rate = ?,
             base_currency = COALESCE(NULLIF(base_currency, ''), ?)
         WHERE id = ?`,
        [currency, currencySymbol, rate, currency, institutionId]
      );

      logger.info('Institution settings updated', { institutionId, currency, exchangeRate: rate });
      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      logger.error('Update institution settings error:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  // GET /settings/currencies — all currencies for this institution
  async getCurrencies(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;
      await seedCurrencies(institutionId);

      const currencies = await db.query(
        `SELECT c.*, er.rate as current_rate_to_base
         FROM currencies c
         LEFT JOIN exchange_rates er
           ON er.institution_id = c.institution_id
           AND er.from_currency = c.code
           AND er.to_currency = (SELECT base_currency FROM institutions WHERE id = c.institution_id)
         WHERE c.institution_id = ?
         ORDER BY c.is_base DESC, c.is_active DESC, c.code`,
        [institutionId]
      );
      res.json({ success: true, data: currencies });
    } catch (error) {
      logger.error('Get currencies error:', error);
      res.status(500).json({ error: 'Failed to get currencies' });
    }
  }

  // GET /settings/exchange-rates — current rates
  async getExchangeRates(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;
      const rates = await db.query(
        `SELECT er.*, 
                fc.name as from_name, fc.symbol as from_symbol,
                tc.name as to_name, tc.symbol as to_symbol
         FROM exchange_rates er
         LEFT JOIN currencies fc ON fc.institution_id = er.institution_id AND fc.code = er.from_currency
         LEFT JOIN currencies tc ON tc.institution_id = er.institution_id AND tc.code = er.to_currency
         WHERE er.institution_id = ?
         ORDER BY er.from_currency, er.to_currency`,
        [institutionId]
      );
      res.json({ success: true, data: rates });
    } catch (error) {
      logger.error('Get exchange rates error:', error);
      res.status(500).json({ error: 'Failed to get exchange rates' });
    }
  }

  // PUT /settings/exchange-rates — upsert a pair + record history
  async upsertExchangeRate(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;
      const userId = req.user?.userId;
      const { fromCurrency, toCurrency, rate, note } = req.body;

      if (!fromCurrency || !toCurrency) return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
      if (fromCurrency === toCurrency) return res.status(400).json({ error: 'From and To currency cannot be the same' });
      const r = parseFloat(rate);
      if (isNaN(r) || r <= 0) return res.status(400).json({ error: 'Rate must be a positive number' });

      const inverseRate = parseFloat((Math.round((1 / r) * 1e8) / 1e8).toFixed(6));

      // Upsert current rates
      await db.query(
        `INSERT INTO exchange_rates (institution_id, from_currency, to_currency, rate)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rate = VALUES(rate), updated_at = NOW()`,
        [institutionId, fromCurrency, toCurrency, r]
      );
      await db.query(
        `INSERT INTO exchange_rates (institution_id, from_currency, to_currency, rate)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rate = VALUES(rate), updated_at = NOW()`,
        [institutionId, toCurrency, fromCurrency, inverseRate]
      );

      // Record history for both directions
      await db.query(
        `INSERT INTO currency_rate_history (institution_id, from_currency, to_currency, rate, inverse_rate, changed_by, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [institutionId, fromCurrency, toCurrency, r, inverseRate, userId || null, note || null]
      );
      await db.query(
        `INSERT INTO currency_rate_history (institution_id, from_currency, to_currency, rate, inverse_rate, changed_by, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [institutionId, toCurrency, fromCurrency, inverseRate, r, userId || null, note || null]
      );

      // Ensure both currencies exist in master
      await seedCurrencies(institutionId);

      logger.info('Exchange rate upserted', { institutionId, fromCurrency, toCurrency, rate: r });
      res.json({ success: true, message: 'Exchange rate saved' });
    } catch (error) {
      logger.error('Upsert exchange rate error:', error);
      res.status(500).json({ error: 'Failed to save exchange rate' });
    }
  }

  // GET /settings/exchange-rates/history — full history with optional filters
  async getRateHistory(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;
      const { fromCurrency, toCurrency, limit = 100 } = req.query;

      let query = `
        SELECT h.*, 
               CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as changed_by_name
        FROM currency_rate_history h
        LEFT JOIN institution_users u ON h.changed_by = u.id
        WHERE h.institution_id = ?`;
      const params = [institutionId];

      if (fromCurrency) { query += ' AND h.from_currency = ?'; params.push(fromCurrency); }
      if (toCurrency)   { query += ' AND h.to_currency = ?';   params.push(toCurrency); }

      query += ` ORDER BY h.changed_at DESC LIMIT ${parseInt(limit)}`;

      const history = await db.query(query, params);
      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('Get rate history error:', error);
      res.status(500).json({ error: 'Failed to get rate history' });
    }
  }

  // Backward compatibility
  async getinstitutionSettings(req, res) { return this.getInstitutionSettings(req, res); }
  async updateinstitutionSettings(req, res) { return this.updateInstitutionSettings(req, res); }
}

module.exports = new SettingsController();
