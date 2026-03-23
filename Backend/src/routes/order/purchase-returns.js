const express = require('express');
const prCtrl = require('../../controllers/order/purchaseReturnController');
const autoPOCtrl = require('../../controllers/order/autoPOController');
const { requirePermission, auditLog } = require('../../middleware/auth');

const router = express.Router();

// Purchase Returns
router.post('/',                          requirePermission('purchase_management'), auditLog('purchase_return_created'),   prCtrl.createPurchaseReturn);
router.get('/',                           requirePermission('purchase_view'),                                              prCtrl.getPurchaseReturns);
router.get('/:returnId',                  requirePermission('purchase_view'),                                              prCtrl.getPurchaseReturn);
router.post('/:returnId/confirm',         requirePermission('purchase_management'), auditLog('purchase_return_confirmed'), prCtrl.confirmPurchaseReturn);
router.post('/:returnId/cancel',          requirePermission('purchase_management'), auditLog('purchase_return_cancelled'), prCtrl.cancelPurchaseReturn);

// Auto-PO Generation
router.get('/auto-po/preview',            requirePermission('purchase_view'),                                              autoPOCtrl.previewAutoPOs);
router.post('/auto-po/generate',          requirePermission('purchase_management'), auditLog('auto_po_generated'),         autoPOCtrl.generateAutoPOs);

module.exports = router;
