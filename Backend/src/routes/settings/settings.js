const express = require('express');
const settingsController = require('../../controllers/settings/settingsController');
const { extractInstitutionContext, auditLog } = require('../../middleware/auth');

const router = express.Router();

router.get('/',                         extractInstitutionContext, settingsController.getInstitutionSettings);
router.put('/',                         extractInstitutionContext, auditLog('settings_updated'), settingsController.updateInstitutionSettings);

router.get('/currencies',               extractInstitutionContext, settingsController.getCurrencies);
router.get('/exchange-rates',           extractInstitutionContext, settingsController.getExchangeRates);
router.put('/exchange-rates',           extractInstitutionContext, auditLog('exchange_rate_updated'), settingsController.upsertExchangeRate);
router.get('/exchange-rates/history',   extractInstitutionContext, settingsController.getRateHistory);

module.exports = router;
