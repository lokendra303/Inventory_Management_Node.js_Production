const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const logger = require('../utils/logger');

class EventStore {
  async appendEvent(tenantId, aggregateType, aggregateId, eventType, eventData, metadata = {}, idempotencyKey = null, expectedVersion = null) {
    if (!idempotencyKey) {
      idempotencyKey = uuidv4();
    }

    return await db.transaction(async (connection) => {
      // Check idempotency
      const [existingEvent] = await connection.execute(
        'SELECT id FROM event_store WHERE tenant_id = ? AND idempotency_key = ?',
        [tenantId, idempotencyKey]
      );

      if (existingEvent.length > 0) {
        logger.warn('Duplicate event detected', { tenantId, idempotencyKey });
        return existingEvent[0].id;
      }

      // Get current version for optimistic locking
      const [versionResult] = await connection.execute(
        'SELECT COALESCE(MAX(aggregate_version), 0) as current_version FROM event_store WHERE tenant_id = ? AND aggregate_type = ? AND aggregate_id = ?',
        [tenantId, aggregateType, aggregateId]
      );

      const currentVersion = versionResult[0].current_version;
      const newVersion = currentVersion + 1;

      // Check expected version for concurrency control
      if (expectedVersion !== null && expectedVersion !== currentVersion) {
        throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion}`);
      }

      // Insert new event
      const eventId = uuidv4();
      await connection.execute(
        `INSERT INTO event_store 
         (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, event_data, metadata, idempotency_key, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          tenantId,
          aggregateType,
          aggregateId,
          newVersion,
          eventType,
          JSON.stringify(eventData),
          JSON.stringify(metadata),
          idempotencyKey,
          metadata.userId || null
        ]
      );

      logger.info('Event appended', {
        tenantId,
        eventId,
        aggregateType,
        aggregateId,
        eventType,
        version: newVersion
      });

      return eventId;
    });
  }

  async getEvents(tenantId, aggregateType, aggregateId, fromVersion = 0) {
    const events = await db.query(
      `SELECT id, aggregate_version, event_type, event_data, metadata, created_at, created_by
       FROM event_store 
       WHERE tenant_id = ? AND aggregate_type = ? AND aggregate_id = ? AND aggregate_version > ?
       ORDER BY aggregate_version ASC`,
      [tenantId, aggregateType, aggregateId, fromVersion]
    );

    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data),
      metadata: JSON.parse(event.metadata || '{}')
    }));
  }

  async getEventsByType(tenantId, eventType, limit = 100, offset = 0) {
    const events = await db.query(
      `SELECT id, aggregate_type, aggregate_id, aggregate_version, event_type, event_data, metadata, created_at, created_by
       FROM event_store 
       WHERE tenant_id = ? AND event_type = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, eventType, limit, offset]
    );

    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data),
      metadata: JSON.parse(event.metadata || '{}')
    }));
  }

  async getCurrentVersion(tenantId, aggregateType, aggregateId) {
    const [result] = await db.query(
      'SELECT COALESCE(MAX(aggregate_version), 0) as version FROM event_store WHERE tenant_id = ? AND aggregate_type = ? AND aggregate_id = ?',
      [tenantId, aggregateType, aggregateId]
    );
    return result[0].version;
  }

  async getEventStream(tenantId, fromTimestamp = null, limit = 100) {
    let query = `
      SELECT id, aggregate_type, aggregate_id, aggregate_version, event_type, event_data, metadata, created_at, created_by
      FROM event_store 
      WHERE tenant_id = ?
    `;
    const params = [tenantId];

    if (fromTimestamp) {
      query += ' AND created_at > ?';
      params.push(fromTimestamp);
    }

    query += ' ORDER BY created_at ASC LIMIT ?';
    params.push(limit);

    const events = await db.query(query, params);

    return events.map(event => ({
      ...event,
      event_data: JSON.parse(event.event_data),
      metadata: JSON.parse(event.metadata || '{}')
    }));
  }
}

module.exports = new EventStore();