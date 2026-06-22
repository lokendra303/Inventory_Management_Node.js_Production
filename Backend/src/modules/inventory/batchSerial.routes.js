const express = require('express');
const ctrl = require('./batchSerial.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

// Batches
router.post('/batches',          requirePermission('inventory_receive'), auditLog('batch_created'),        ctrl.createBatch);
router.get('/batches',           requirePermission('inventory_view'),                                      ctrl.getBatches);
router.post('/batches/:batchId/consume', requirePermission('inventory_adjust'), auditLog('batch_consumed'), ctrl.consumeBatch);
router.put('/batches/:batchId/status',   requirePermission('inventory_adjust'), auditLog('batch_status_updated'), ctrl.updateBatchStatus);
router.put('/batches/:batchId/dates',    requirePermission('inventory_adjust'), auditLog('batch_dates_updated'), ctrl.updateBatchDates);

// Serials
router.post('/serials',          requirePermission('inventory_receive'), auditLog('serials_created'),      ctrl.createSerials);
router.get('/serials',           requirePermission('inventory_view'),                                      ctrl.getSerials);
router.put('/serials/:serialId/status', requirePermission('inventory_adjust'), auditLog('serial_status_updated'), ctrl.updateSerialStatus);

// Expiry Alerts
router.get('/expiry-alerts',     requirePermission('inventory_view'),                                      ctrl.getExpiryAlerts);
router.put('/expiry-alerts/:alertId/acknowledge', requirePermission('inventory_view'), auditLog('expiry_alert_acknowledged'), ctrl.acknowledgeExpiryAlert);
router.post('/expiry-alerts/refresh', requirePermission('inventory_management'),                           ctrl.refreshExpiryAlerts);

router.get('/movements', requirePermission('inventory_view'), ctrl.getMovements);

module.exports = router;
