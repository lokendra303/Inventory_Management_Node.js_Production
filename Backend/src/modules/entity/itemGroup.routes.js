const express = require('express');
const itemGroupController = require('./itemGroup.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

router.get('/',
  requirePermission('item_view'),
  itemGroupController.getItemGroups
);

router.post('/',
  requirePermission('item_management'),
  auditLog('item_group_created'),
  itemGroupController.createItemGroup
);

router.put('/:id',
  requirePermission('item_management'),
  auditLog('item_group_updated'),
  itemGroupController.updateItemGroup
);

router.delete('/:id',
  requirePermission('item_management'),
  auditLog('item_group_deleted'),
  itemGroupController.deleteItemGroup
);

module.exports = router;
