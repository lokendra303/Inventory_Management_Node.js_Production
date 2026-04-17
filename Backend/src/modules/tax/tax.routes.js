const express = require('express');
const c = require('./tax.controller');
const router = express.Router();

// Tax Types
router.get('/types',           c.getTaxTypes);
router.post('/types',          c.createTaxType);
router.delete('/types/:id',    c.deleteTaxType);

// Tax Groups
router.get('/groups',          c.getTaxGroups);
router.post('/groups',         c.createTaxGroup);
router.put('/groups/:id',      c.updateTaxGroup);
router.delete('/groups/:id',   c.deleteTaxGroup);

// Tax Rates
router.get('/rates',           c.getTaxRates);
router.post('/rates',          c.createTaxRate);
router.put('/rates/:id',       c.updateTaxRate);
router.delete('/rates/:id',    c.deleteTaxRate);
router.get('/rates/:id',       c.getTaxRate);

module.exports = router;
