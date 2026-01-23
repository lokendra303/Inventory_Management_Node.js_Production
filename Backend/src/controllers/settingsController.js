const db = require('../database/connection');
const logger = require('../utils/logger');
const CurrencyService = require('../utils/currencyService');

class SettingsController {
  async getTenantSettings(req, res) {
    try {
      const { tenantId } = req.user;
      
      const tenant = await db.query(
        'SELECT currency, currency_symbol FROM tenants WHERE id = ?',
        [tenantId]
      );
      
      if (tenant.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      const settings = {
        currency: tenant[0].currency || 'USD',
        currencySymbol: tenant[0].currency_symbol || '$',
        availableCurrencies: CurrencyService.getCurrencies()
      };
      
      res.json({ success: true, data: settings });
    } catch (error) {
      logger.error('Get tenant settings error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }
  
  async updateTenantSettings(req, res) {
    try {
      const { tenantId } = req.user;
      const { currency } = req.body;
      
      if (!currency) {
        return res.status(400).json({ error: 'Currency is required' });
      }
      
      const currencySymbol = CurrencyService.getCurrencySymbol(currency);
      
      await db.query(
        'UPDATE tenants SET currency = ?, currency_symbol = ? WHERE id = ?',
        [currency, currencySymbol, tenantId]
      );
      
      logger.info('Tenant settings updated', { tenantId, currency });
      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      logger.error('Update tenant settings error:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
}

module.exports = new SettingsController();