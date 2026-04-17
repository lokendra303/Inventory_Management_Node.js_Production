const express = require('express');
const c = require('./priceList.controller');
const router = express.Router();

router.get('/',                          c.getAll);
router.post('/',                         c.create);
router.get('/:id',                       c.getOne);
router.put('/:id',                       c.update);
router.delete('/:id',                    c.delete);
router.post('/:id/items',                c.upsertItem);
router.delete('/:id/items/:itemId',      c.removeItem);
router.get('/:id/items/:itemId/price',   c.getItemPrice);

module.exports = router;
