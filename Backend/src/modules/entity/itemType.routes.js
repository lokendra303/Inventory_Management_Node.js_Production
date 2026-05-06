const express = require('express');
const itemTypeController = require('./itemType.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

router.get('/',
  requirePermission('item_view'),
  itemTypeController.getItemTypes
);

router.post('/',
  requirePermission('item_management'),
  auditLog('item_type_created'),
  itemTypeController.createItemType
);

router.delete('/:id',
  requirePermission('item_management'),
  auditLog('item_type_deleted'),
  itemTypeController.deleteItemType
);

module.exports = router;
