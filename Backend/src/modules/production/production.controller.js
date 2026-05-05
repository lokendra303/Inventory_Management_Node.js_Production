const productionService = require('./production.service');
const logger = require('../../utils/logger');

class ProductionController {
  async createMaster(req, res) {
    try {
      const masterId = await productionService.createMaster(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Production master created', data: { masterId } });
    } catch (error) {
      logger.error('Production master creation failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async listMasters(req, res) {
    try {
      const data = await productionService.listMasters(req.institutionId, { status: req.query.status });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to list production masters', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async createBomVersion(req, res) {
    try {
      const bomVersionId = await productionService.createBomVersion(
        req.institutionId,
        req.params.masterId,
        req.body,
        req.user.userId
      );
      res.status(201).json({ success: true, message: 'BOM version created', data: { bomVersionId } });
    } catch (error) {
      logger.error('BOM version creation failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async createOrder(req, res) {
    try {
      const result = await productionService.createOrder(req.institutionId, req.body, req.user.userId);
      res.status(201).json({ success: true, message: 'Production order created', data: result });
    } catch (error) {
      logger.error('Production order creation failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async listOrders(req, res) {
    try {
      const data = await productionService.listOrders(req.institutionId, { status: req.query.status });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to list production orders', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async checkAvailability(req, res) {
    try {
      const data = await productionService.checkAvailability(req.institutionId, req.params.orderId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Availability check failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getAvailabilitySummary(req, res) {
    try {
      const data = await productionService.getAvailabilitySummary(req.institutionId, req.params.orderId);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Availability summary failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async completeOrder(req, res) {
    try {
      const data = await productionService.completeOrder(
        req.institutionId,
        req.params.orderId,
        req.body,
        req.user.userId
      );
      res.json({ success: true, message: 'Production completed successfully', data });
    } catch (error) {
      logger.error('Production completion failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionController();
