const db = require('../../database/connection');
const logger = require('../../utils/logger');
const CurrencyService = require('../../utils/currencyService');

let tablesEnsured = false;

async function ensureTables() {
  if (tablesEnsured) return;
  // Currency / institution columns: 000_initial_schema — not created at runtime
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

      const activeCurrency   = institution[0].currency || 'USD';
      const baseCurrency     = institution[0].base_currency || 'USD';
      let   liveRate         = 1;

      // Read rate from exchange_rates table (source of truth)
      if (activeCurrency !== baseCurrency) {
        const rateRows = await db.query(
          'SELECT rate FROM exchange_rates WHERE institution_id=? AND from_currency=? AND to_currency=? LIMIT 1',
          [institutionId, baseCurrency, activeCurrency]
        );
        if (rateRows.length > 0) {
          liveRate = parseFloat(rateRows[0].rate) || 1;
        } else {
          // Fallback to institutions column if no live rate saved yet
          liveRate = parseFloat(institution[0].exchange_rate) || 1;
        }
      }

      res.json({
        success: true,
        data: {
          currency:           activeCurrency,
          currencySymbol:     institution[0].currency_symbol || '$',
          exchangeRate:       liveRate,
          baseCurrency:       baseCurrency,
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

      query += ' ORDER BY h.changed_at DESC LIMIT ?';
      params.push(parseInt(limit) || 100);

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

  // GET /settings/exchange-rates/live?base=USD&to=INR
  // Fetches a single live rate from exchangerate-api.com (free, no key needed)
  async getLiveRate(req, res) {
    try {
      const { base = 'USD', to } = req.query;
      if (!to) return res.status(400).json({ success: false, error: '"to" currency is required' });
      if (base === to) return res.json({ success: true, data: { base, to, rate: 1, source: 'same_currency' } });

      const axios = require('axios');
      // Free open endpoint — no API key required
      const url = `https://open.er-api.com/v6/latest/${base.toUpperCase()}`;
      const response = await axios.get(url, { timeout: 8000 });

      if (response.data?.result !== 'success') {
        return res.status(502).json({ success: false, error: 'Live rate provider returned an error' });
      }

      const rates = response.data.rates;
      const toUpper = to.toUpperCase();
      if (!rates[toUpper]) {
        return res.status(404).json({ success: false, error: `Currency ${toUpper} not found in live rates` });
      }

      const rate = parseFloat(rates[toUpper].toFixed(6));
      const inverseRate = parseFloat((1 / rate).toFixed(6));
      const lastUpdated = response.data.time_last_update_utc;

      logger.info('Live rate fetched', { base, to: toUpper, rate });
      res.json({
        success: true,
        data: { base: base.toUpperCase(), to: toUpper, rate, inverseRate, lastUpdated, source: 'open.er-api.com' }
      });
    } catch (error) {
      logger.error('getLiveRate error', { error: error.message });
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return res.status(504).json({ success: false, error: 'Live rate request timed out. Check your internet connection.' });
      }
      res.status(502).json({ success: false, error: 'Failed to fetch live rate. Try again.' });
    }
  }

  // POST /settings/exchange-rates/live-sync
  // Fetches ALL rates for a base currency and saves them to DB in one shot
  async syncAllLiveRates(req, res) {
    try {
      await ensureTables();
      const institutionId = req.institutionId || req.user?.institutionId;
      const userId = req.user?.userId;
      const { base = 'USD' } = req.body;

      const axios = require('axios');
      const url = `https://open.er-api.com/v6/latest/${base.toUpperCase()}`;
      const response = await axios.get(url, { timeout: 10000 });

      if (response.data?.result !== 'success') {
        return res.status(502).json({ success: false, error: 'Live rate provider returned an error' });
      }

      const rates = response.data.rates;
      const lastUpdated = response.data.time_last_update_utc;
      const baseUpper = base.toUpperCase();
      let savedCount = 0;

      // Save every pair: base → X and X → base
      for (const [toCurrency, rate] of Object.entries(rates)) {
        if (toCurrency === baseUpper) continue;
        const r = parseFloat(rate.toFixed(6));
        const inv = parseFloat((1 / r).toFixed(6));
        const note = `Live sync from open.er-api.com — ${lastUpdated}`;

        // Upsert base → to
        await db.query(
          `INSERT INTO exchange_rates (institution_id, from_currency, to_currency, rate)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE rate = VALUES(rate), updated_at = NOW()`,
          [institutionId, baseUpper, toCurrency, r]
        );
        // Upsert to → base
        await db.query(
          `INSERT INTO exchange_rates (institution_id, from_currency, to_currency, rate)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE rate = VALUES(rate), updated_at = NOW()`,
          [institutionId, toCurrency, baseUpper, inv]
        );
        // History entry
        await db.query(
          `INSERT INTO currency_rate_history (institution_id, from_currency, to_currency, rate, inverse_rate, changed_by, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [institutionId, baseUpper, toCurrency, r, inv, userId || null, note]
        );
        savedCount++;
      }

      await seedCurrencies(institutionId);
      logger.info('Live rates synced', { institutionId, base: baseUpper, savedCount, lastUpdated });

      res.json({
        success: true,
        message: `Synced ${savedCount} live rates for ${baseUpper}`,
        data: { base: baseUpper, savedCount, lastUpdated, source: 'open.er-api.com' }
      });
    } catch (error) {
      logger.error('syncAllLiveRates error', { error: error.message });
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return res.status(504).json({ success: false, error: 'Live rate sync timed out. Check your internet connection.' });
      }
      res.status(502).json({ success: false, error: 'Failed to sync live rates. Try again.' });
    }
  }
}

module.exports = new SettingsController();
