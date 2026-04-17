const express = require('express');
const c = require('./workflow.controller');
const router = express.Router();

router.get('/',            c.getRules);
router.post('/',           c.createRule);
router.get('/logs',        c.getLogs);
router.get('/:id',         c.getRule);
router.put('/:id',         c.updateRule);
router.delete('/:id',      c.deleteRule);
router.post('/:id/toggle', c.toggleRule);

module.exports = router;
