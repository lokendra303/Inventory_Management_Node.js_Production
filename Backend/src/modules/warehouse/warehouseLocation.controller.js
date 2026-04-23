const service = require('./warehouseLocation.service');
const logger = require('../../utils/logger');

function respondError(res, error, context) {
  const status = /not found/i.test(error.message) ? 404 : 400;
  logger.error(context, { error: error.message });
  return res.status(status).json({ success: false, error: error.message });
}

class WarehouseLocationController {
  // ── Zones ──
  async createZone(req, res) {
    try {
      const id = await service.createZone(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Zone created', data: { id } });
    } catch (error) {
      respondError(res, error, 'Zone create failed');
    }
  }

  async listZones(req, res) {
    try {
      const zones = await service.getZones(req.institutionId, {
        warehouseId: req.query.warehouseId,
        status: req.query.status,
        search: req.query.search,
      });
      res.json({ success: true, data: zones });
    } catch (error) {
      respondError(res, error, 'Zone list failed');
    }
  }

  async updateZone(req, res) {
    try {
      await service.updateZone(req.institutionId, req.params.zoneId, req.body, req.user.userId);
      res.json({ success: true, message: 'Zone updated' });
    } catch (error) {
      respondError(res, error, 'Zone update failed');
    }
  }

  async deleteZone(req, res) {
    try {
      await service.deleteZone(req.institutionId, req.params.zoneId, req.user.userId);
      res.json({ success: true, message: 'Zone deleted' });
    } catch (error) {
      respondError(res, error, 'Zone delete failed');
    }
  }

  // ── Racks ──
  async createRack(req, res) {
    try {
      const id = await service.createRack(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Rack created', data: { id } });
    } catch (error) {
      respondError(res, error, 'Rack create failed');
    }
  }

  async listRacks(req, res) {
    try {
      const racks = await service.getRacks(req.institutionId, {
        warehouseId: req.query.warehouseId,
        zoneId: req.query.zoneId,
        status: req.query.status,
        search: req.query.search,
      });
      res.json({ success: true, data: racks });
    } catch (error) {
      respondError(res, error, 'Rack list failed');
    }
  }

  async updateRack(req, res) {
    try {
      await service.updateRack(req.institutionId, req.params.rackId, req.body, req.user.userId);
      res.json({ success: true, message: 'Rack updated' });
    } catch (error) {
      respondError(res, error, 'Rack update failed');
    }
  }

  async deleteRack(req, res) {
    try {
      await service.deleteRack(req.institutionId, req.params.rackId, req.user.userId);
      res.json({ success: true, message: 'Rack deleted' });
    } catch (error) {
      respondError(res, error, 'Rack delete failed');
    }
  }

  // ── Bins ──
  async createBin(req, res) {
    try {
      const id = await service.createBin(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Bin created', data: { id } });
    } catch (error) {
      respondError(res, error, 'Bin create failed');
    }
  }

  async listBins(req, res) {
    try {
      const bins = await service.getBins(req.institutionId, {
        warehouseId: req.query.warehouseId,
        zoneId: req.query.zoneId,
        rackId: req.query.rackId,
        status: req.query.status,
        search: req.query.search,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      res.json({ success: true, data: bins });
    } catch (error) {
      respondError(res, error, 'Bin list failed');
    }
  }

  async getBin(req, res) {
    try {
      const bin = await service.getBinById(req.institutionId, req.params.binId);
      if (!bin) return res.status(404).json({ success: false, error: 'Bin not found' });
      res.json({ success: true, data: bin });
    } catch (error) {
      respondError(res, error, 'Bin get failed');
    }
  }

  async updateBin(req, res) {
    try {
      await service.updateBin(req.institutionId, req.params.binId, req.body, req.user.userId);
      res.json({ success: true, message: 'Bin updated' });
    } catch (error) {
      respondError(res, error, 'Bin update failed');
    }
  }

  async deleteBin(req, res) {
    try {
      await service.deleteBin(req.institutionId, req.params.binId, req.user.userId);
      res.json({ success: true, message: 'Bin deleted' });
    } catch (error) {
      respondError(res, error, 'Bin delete failed');
    }
  }

  async importBins(req, res) {
    try {
      const rows = Array.isArray(req.body) ? req.body : req.body?.rows;
      const summary = await service.importBins(req.institutionId, rows, req.user.userId);
      res.json({ success: true, ...summary });
    } catch (error) {
      respondError(res, error, 'Bin import failed');
    }
  }

  async getHierarchy(req, res) {
    try {
      const data = await service.getWarehouseHierarchy(req.institutionId, req.params.warehouseId);
      res.json({ success: true, data });
    } catch (error) {
      respondError(res, error, 'Warehouse hierarchy failed');
    }
  }

  async getConstants(req, res) {
    try {
      const data = await service.getConstants(req.institutionId);
      res.json({ success: true, data });
    } catch (error) {
      respondError(res, error, 'Warehouse constants failed');
    }
  }

  // ── Zone types catalog ──
  async listZoneTypes(req, res) {
    try {
      const rows = await service.listZoneTypes(req.institutionId, { status: req.query.status });
      res.json({ success: true, data: rows });
    } catch (error) { respondError(res, error, 'Zone-type list failed'); }
  }
  async createZoneType(req, res) {
    try {
      const id = await service.createZoneType(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Zone type created', data: { id } });
    } catch (error) { respondError(res, error, 'Zone-type create failed'); }
  }
  async updateZoneType(req, res) {
    try {
      await service.updateZoneType(req.institutionId, req.params.id, req.body, req.user.userId);
      res.json({ success: true, message: 'Zone type updated' });
    } catch (error) { respondError(res, error, 'Zone-type update failed'); }
  }
  async deleteZoneType(req, res) {
    try {
      await service.deleteZoneType(req.institutionId, req.params.id, req.user.userId);
      res.json({ success: true, message: 'Zone type deleted' });
    } catch (error) { respondError(res, error, 'Zone-type delete failed'); }
  }

  // ── Bin types catalog ──
  async listBinTypes(req, res) {
    try {
      const rows = await service.listBinTypes(req.institutionId, { status: req.query.status });
      res.json({ success: true, data: rows });
    } catch (error) { respondError(res, error, 'Bin-type list failed'); }
  }
  async createBinType(req, res) {
    try {
      const id = await service.createBinType(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Bin type created', data: { id } });
    } catch (error) { respondError(res, error, 'Bin-type create failed'); }
  }
  async updateBinType(req, res) {
    try {
      await service.updateBinType(req.institutionId, req.params.id, req.body, req.user.userId);
      res.json({ success: true, message: 'Bin type updated' });
    } catch (error) { respondError(res, error, 'Bin-type update failed'); }
  }
  async deleteBinType(req, res) {
    try {
      await service.deleteBinType(req.institutionId, req.params.id, req.user.userId);
      res.json({ success: true, message: 'Bin type deleted' });
    } catch (error) { respondError(res, error, 'Bin-type delete failed'); }
  }
}

module.exports = new WarehouseLocationController();
