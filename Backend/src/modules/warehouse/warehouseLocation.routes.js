const express = require('express');
const controller = require('./warehouseLocation.controller');
const { requirePermission, auditLog } = require('../auth/auth.middleware');

const router = express.Router();

// Allowed bin/zone enums for UI selects
router.get('/constants',
  requirePermission('warehouse_view'),
  controller.getConstants
);

// ── Zones ──
router.get('/zones',
  requirePermission('warehouse_view'),
  controller.listZones
);

router.post('/zones',
  requirePermission('warehouse_management'),
  auditLog('warehouse_zone_created'),
  controller.createZone
);

router.put('/zones/:zoneId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_zone_updated'),
  controller.updateZone
);

router.delete('/zones/:zoneId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_zone_deleted'),
  controller.deleteZone
);

// ── Racks ──
router.get('/racks',
  requirePermission('warehouse_view'),
  controller.listRacks
);

router.post('/racks',
  requirePermission('warehouse_management'),
  auditLog('warehouse_rack_created'),
  controller.createRack
);

router.put('/racks/:rackId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_rack_updated'),
  controller.updateRack
);

router.delete('/racks/:rackId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_rack_deleted'),
  controller.deleteRack
);

// ── Bins ──
router.get('/bins',
  requirePermission('warehouse_view'),
  controller.listBins
);

router.post('/bins',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bin_created'),
  controller.createBin
);

router.post('/bins/import',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bins_imported'),
  controller.importBins
);

router.get('/bins/:binId',
  requirePermission('warehouse_view'),
  controller.getBin
);

router.put('/bins/:binId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bin_updated'),
  controller.updateBin
);

router.delete('/bins/:binId',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bin_deleted'),
  controller.deleteBin
);

// ── Hierarchy: zones → racks → bins for a single warehouse ──
router.get('/warehouses/:warehouseId/hierarchy',
  requirePermission('warehouse_view'),
  controller.getHierarchy
);

// ── Zone types catalog (user-customizable) ──
router.get('/zone-types',
  requirePermission('warehouse_view'),
  controller.listZoneTypes
);
router.post('/zone-types',
  requirePermission('warehouse_management'),
  auditLog('warehouse_zone_type_created'),
  controller.createZoneType
);
router.put('/zone-types/:id',
  requirePermission('warehouse_management'),
  auditLog('warehouse_zone_type_updated'),
  controller.updateZoneType
);
router.delete('/zone-types/:id',
  requirePermission('warehouse_management'),
  auditLog('warehouse_zone_type_deleted'),
  controller.deleteZoneType
);

// ── Bin types catalog (user-customizable) ──
router.get('/bin-types',
  requirePermission('warehouse_view'),
  controller.listBinTypes
);
router.post('/bin-types',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bin_type_created'),
  controller.createBinType
);
router.put('/bin-types/:id',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bin_type_updated'),
  controller.updateBinType
);
router.delete('/bin-types/:id',
  requirePermission('warehouse_management'),
  auditLog('warehouse_bin_type_deleted'),
  controller.deleteBinType
);

module.exports = router;
