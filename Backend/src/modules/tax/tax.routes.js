const express = require('express');
const c = require('./tax.controller');
const router = express.Router();

router.get('/groups',          c.getTaxGroups);
router.post('/groups',         c.createTaxGroup);
router.put('/groups/:id',      c.updateTaxGroup);
router.delete('/groups/:id',   c.deleteTaxGroup);

router.get('/rates',           c.getTaxRates);
router.post('/rates',          c.createTaxRate);
router.put('/rates/:id',       c.updateTaxRate);
router.delete('/rates/:id',    c.deleteTaxRate);

// Resolve a single tax rate by ID — used by invoice/SO forms
router.get('/rates/:id',       c.getTaxRate);

module.exports = router;
