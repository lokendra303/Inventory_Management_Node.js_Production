const db = require('../../database/connection');
const logger = require('../../utils/logger');
const CurrencyService = require('../../utils/currencyService');

class SettingsController {
  async getInstitutionSettings(req, res) {
    try {
      const institutionId = req.institutionId || req.user?.institutionId;
      
      const institution = await db.query(
        'SELECT currency, currency_symbol FROM institutions WHERE id = ?',
        [institutionId]
      );
      
      if (institution.length === 0) {
        return res.status(404).json({ error: 'Institution not found' });
      }
      
      const settings = {
        currency: institution[0].currency || 'USD',
        currencySymbol: institution[0].currency_symbol || '$',
        availableCurrencies: CurrencyService.getCurrencies()
      };
      
      res.json({ success: true, data: settings });
    } catch (error) {
      logger.error('Get institution settings error:', error);
      
      // If currency columns don't exist, return default values
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        const settings = {
          currency: 'USD',
          currencySymbol: '$',
          availableCurrencies: CurrencyService.getCurrencies()
        };
        return res.json({ success: true, data: settings });
      }
      
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }
  
  async updateInstitutionSettings(req, res) {
    try {
      const institutionId = req.institutionId || req.user?.institutionId;
      const { currency } = req.body;
      
      if (!currency) {
        return res.status(400).json({ error: 'Currency is required' });
      }
      
      const currencySymbol = CurrencyService.getCurrencySymbol(currency);
      
      await db.query(
        'UPDATE institutions SET currency = ?, currency_symbol = ? WHERE id = ?',
        [currency, currencySymbol, institutionId]
      );
      
      logger.info('Institution settings updated', { institutionId, currency });
      res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
      logger.error('Update institution settings error:', error);
      
      // If currency columns don't exist, return error with helpful message
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        return res.status(500).json({ 
          error: 'Currency system not properly configured. Please run database migration.' 
        });
      }
      
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  // Backward compatibility
  async getinstitutionSettings(req, res) {
    return this.getInstitutionSettings(req, res);
  }
  
  async updateinstitutionSettings(req, res) {
    return this.updateInstitutionSettings(req, res);
  }
}

module.exports = new SettingsController();
