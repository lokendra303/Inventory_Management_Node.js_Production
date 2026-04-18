const express = require('express');
const c = require('./priceList.controller');
const { checkFeature } = require('../../middleware/subscriptionGate');
const router = express.Router();

router.get('/',                          checkFeature('price_lists'), c.getAll);
router.post('/',                         checkFeature('price_lists'), c.create);
router.get('/:id',                       checkFeature('price_lists'), c.getOne);
router.put('/:id',                       checkFeature('price_lists'), c.update);
router.delete('/:id',                    checkFeature('price_lists'), c.delete);
router.post('/:id/items',                checkFeature('price_lists'), c.upsertItem);
router.delete('/:id/items/:itemId',      checkFeature('price_lists'), c.removeItem);
router.get('/:id/items/:itemId/price',   checkFeature('price_lists'), c.getItemPrice);

module.exports = router;
