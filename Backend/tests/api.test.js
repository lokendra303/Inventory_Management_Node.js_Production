const request = require('supertest');
const Server = require('../src/server');
const db = require('../src/database/connection');

/**
 * Comprehensive API Test Suite
 * 
 * Tests core functionality including:
 * - Authentication endpoints
 * - Protected route security
 * - Event store functionality
 * - Inventory service operations
 * 
 * Run with: npm test
 * Requires: Jest testing framework
 */

describe('IMS SEPCUNE API Tests', () => {
  let server;
  let app;

  beforeAll(async () => {
    server = new Server();
    app = await server.start();
  });

  afterAll(async () => {
    await server.shutdown();
  });

  describe('Health Check', () => {
    test('GET /api/health should return OK', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication', () => {
    test('POST /api/auth/login should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });

    test('POST /api/auth/register-institution should create new institution', async () => {
      const institutionData = {
        name: 'Test Company',
        subdomain: 'test-company-' + Date.now(),
        adminEmail: 'admin@test.com',
        adminPassword: 'password123',
        adminFirstName: 'Admin',
        adminLastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register-institution')
        .send(institutionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.institutionId).toBeDefined();
      expect(response.body.data.userId).toBeDefined();
    });
  });

  describe('Protected Routes', () => {
    test('GET /api/inventory should require authentication', async () => {
      const response = await request(app)
        .get('/api/inventory')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});

// Event Store Tests
describe('Event Store', () => {
  const eventStore = require('../src/events/eventStore');
  const testinstitutionId = 'test-institution-' + Date.now();

  test('should append and retrieve events', async () => {
    const eventData = {
      itemId: 'test-item',
      warehouseId: 'test-warehouse',
      quantity: 100,
      unitCost: 10.50
    };

    const eventId = await eventStore.appendEvent(
      testinstitutionId,
      'inventory',
      'test-item:test-warehouse',
      'PurchaseReceived',
      eventData,
      { userId: 'test-user' }
    );

    expect(eventId).toBeDefined();

    const events = await eventStore.getEvents(
      testinstitutionId,
      'inventory',
      'test-item:test-warehouse'
    );

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('PurchaseReceived');
    expect(events[0].event_data.quantity).toBe(100);
  });

  test('should prevent duplicate events with same idempotency key', async () => {
    const eventData = {
      itemId: 'test-item-2',
      warehouseId: 'test-warehouse',
      quantity: 50,
      unitCost: 15.00
    };

    const idempotencyKey = 'test-key-' + Date.now();

    const eventId1 = await eventStore.appendEvent(
      testinstitutionId,
      'inventory',
      'test-item-2:test-warehouse',
      'PurchaseReceived',
      eventData,
      { userId: 'test-user' },
      idempotencyKey
    );

    const eventId2 = await eventStore.appendEvent(
      testinstitutionId,
      'inventory',
      'test-item-2:test-warehouse',
      'PurchaseReceived',
      eventData,
      { userId: 'test-user' },
      idempotencyKey
    );

    expect(eventId1).toBe(eventId2);
  });
});

// Inventory Service Tests
describe('Inventory Service', () => {
  const inventoryService = require('../src/services/inventoryService');
  const testinstitutionId = 'test-institution-inv-' + Date.now();

  test('should receive stock and update projections', async () => {
    const stockData = {
      itemId: 'test-item-inv',
      warehouseId: 'test-warehouse-inv',
      quantity: 100,
      unitCost: 25.00,
      poId: 'test-po',
      poLineId: 'test-po-line',
      grnNumber: 'GRN-001'
    };

    const eventId = await inventoryService.receiveStock(
      testinstitutionId,
      stockData,
      'test-user'
    );

    expect(eventId).toBeDefined();

    // Check projection was updated
    const stock = await inventoryService.getCurrentStock(
      testinstitutionId,
      stockData.itemId,
      stockData.warehouseId
    );

    expect(stock).toBeDefined();
    expect(stock.quantity_on_hand).toBe(100);
    expect(stock.quantity_available).toBe(100);
  });

  test('should prevent overselling', async () => {
    const reserveData = {
      itemId: 'test-item-oversell',
      warehouseId: 'test-warehouse-oversell',
      quantity: 1000, // More than available
      unitPrice: 30.00,
      soId: 'test-so',
      soLineId: 'test-so-line'
    };

    await expect(
      inventoryService.reserveStock(testinstitutionId, reserveData, 'test-user')
    ).rejects.toThrow('Insufficient stock');
  });
});

module.exports = {};