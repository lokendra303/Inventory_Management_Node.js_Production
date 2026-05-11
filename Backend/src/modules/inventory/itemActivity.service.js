const db = require('../../database/connection');
const logger = require('../../utils/logger');

const ITEM_AUDIT_EVENT_TYPES = {
  item_created: 'ITEM_CREATED',
  item_updated: 'ITEM_UPDATED',
  item_deleted: 'ITEM_DELETED',
  item_components_updated: 'ITEM_COMPONENTS_UPDATED'
};

const ITEM_AUDIT_FIELD_LABELS = {
  sku: 'SKU',
  name: 'Name',
  description: 'Description',
  type: 'Type',
  category: 'Category',
  unit: 'Unit',
  barcode: 'Barcode',
  hsnCode: 'HSN Code',
  customFields: 'Custom Fields',
  valuationMethod: 'Valuation Method',
  allowNegativeStock: 'Allow Negative Stock',
  status: 'Status',
  costPrice: 'Cost Price',
  sellingPrice: 'Selling Price',
  mrp: 'MRP',
  taxRate: 'Tax Rate',
  brand: 'Brand',
  manufacturer: 'Manufacturer',
  itemGroup: 'Item Group',
  minStockLevel: 'Min Stock',
  maxStockLevel: 'Max Stock',
  warehouseId: 'Warehouse',
  weight: 'Weight',
  dimensions: 'Dimensions',
  upc: 'UPC',
  ean: 'EAN',
  isbn: 'ISBN',
  mpn: 'MPN',
  openingStock: 'Opening Stock',
  openingValue: 'Opening Value',
  defaultBinId: 'Default Bin',
  components: 'Components'
};

const parseJsonColumn = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeAuditValue = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeAuditValue(entry));
  }
  if (typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = normalizeAuditValue(value[key]);
      return acc;
    }, {});
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value) : null;
  }
  return value;
};

const stableAuditStringify = (value) => JSON.stringify(normalizeAuditValue(value));

const areAuditValuesEqual = (left, right) => stableAuditStringify(left) === stableAuditStringify(right);

const summarizeAuditValue = (value) => {
  const normalized = normalizeAuditValue(value);
  if (normalized == null) return 'Empty';
  if (Array.isArray(normalized)) {
    if (normalized.length === 0) return 'Empty';
    if (normalized.every((entry) => entry == null || typeof entry !== 'object')) {
      const joined = normalized.map((entry) => entry == null ? 'Empty' : String(entry)).join(', ');
      return joined.length > 80 ? `${joined.slice(0, 77)}...` : joined;
    }
    return `${normalized.length} item${normalized.length === 1 ? '' : 's'}`;
  }
  if (typeof normalized === 'object') {
    const json = JSON.stringify(normalized);
    return json.length > 80 ? `${json.slice(0, 77)}...` : json;
  }
  return String(normalized);
};

const buildItemAuditFieldChanges = (action, before = null, after = null) => {
  if (!['item_updated', 'item_components_updated'].includes(action)) {
    return [];
  }
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return [];
  }

  const previous = before;
  const current = after;

  return Object.entries(ITEM_AUDIT_FIELD_LABELS).reduce((changes, [field, label]) => {
    if (areAuditValuesEqual(previous[field], current[field])) {
      return changes;
    }

    changes.push({
      field,
      label,
      from: normalizeAuditValue(previous[field]),
      to: normalizeAuditValue(current[field]),
      from_display: summarizeAuditValue(previous[field]),
      to_display: summarizeAuditValue(current[field])
    });
    return changes;
  }, []);
};

const buildItemAuditSummary = (action, fieldChanges = []) => {
  if (action === 'item_created') return 'Item master created';
  if (action === 'item_deleted') return 'Item marked inactive';
  if (action === 'item_components_updated') {
    return fieldChanges.length > 0
      ? `Updated ${fieldChanges.map((change) => change.label).join(', ')}`
      : 'Composite components updated';
  }
  if (fieldChanges.length > 0) {
    return `Updated ${fieldChanges.map((change) => change.label).join(', ')}`;
  }
  return 'Item master updated';
};

class ItemActivityService {
  async getItemActivitySummary(institutionId, itemId, warehouseId = null) {
    try {
      const whereClause = warehouseId 
        ? 'WHERE ip.institution_id = ? AND ip.item_id = ? AND ip.warehouse_id = ?' 
        : 'WHERE ip.institution_id = ? AND ip.item_id = ?';
      const params = warehouseId ? [institutionId, itemId, warehouseId] : [institutionId, itemId];

      // Get current stock
      const currentStock = await db.query(
        `SELECT ip.*, i.sku, i.name as item_name, i.unit, w.name as warehouse_name
         FROM inventory_projections ip
         JOIN items i ON ip.item_id = i.id
         LEFT JOIN warehouses w ON ip.warehouse_id = w.id
         ${whereClause}`,
        params
      );

      // Get all activity logs with aggregated quantities
      const activities = await db.query(
        `SELECT 
          'PURCHASE' as operation_type,
          'RECEIVED' as sub_type,
          COUNT(*) as transaction_count,
          SUM(JSON_EXTRACT(es.event_data, '$.quantity')) as total_quantity,
          AVG(JSON_EXTRACT(es.event_data, '$.unitCost')) as avg_unit_cost,
          MIN(es.created_at) as first_date,
          MAX(es.created_at) as last_date,
          ip.warehouse_id,
          w.name as warehouse_name
        FROM event_store es
        JOIN inventory_projections ip ON JSON_EXTRACT(es.event_data, '$.itemId') = ip.item_id 
          AND JSON_EXTRACT(es.event_data, '$.warehouseId') = ip.warehouse_id
        LEFT JOIN warehouses w ON ip.warehouse_id = w.id
        WHERE es.institution_id = ? 
          AND JSON_EXTRACT(es.event_data, '$.itemId') = ?
          ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
          AND es.event_type = 'PURCHASE_RECEIVED'
        GROUP BY ip.warehouse_id, w.name

        UNION ALL

        SELECT 
          'SALES' as operation_type,
          'RESERVED' as sub_type,
          COUNT(*) as transaction_count,
          SUM(JSON_EXTRACT(es.event_data, '$.quantity')) as total_quantity,
          AVG(JSON_EXTRACT(es.event_data, '$.unitPrice')) as avg_unit_cost,
          MIN(es.created_at) as first_date,
          MAX(es.created_at) as last_date,
          ip.warehouse_id,
          w.name as warehouse_name
        FROM event_store es
        JOIN inventory_projections ip ON JSON_EXTRACT(es.event_data, '$.itemId') = ip.item_id 
          AND JSON_EXTRACT(es.event_data, '$.warehouseId') = ip.warehouse_id
        LEFT JOIN warehouses w ON ip.warehouse_id = w.id
        WHERE es.institution_id = ? 
          AND JSON_EXTRACT(es.event_data, '$.itemId') = ?
          ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
          AND es.event_type = 'SALE_RESERVED'
        GROUP BY ip.warehouse_id, w.name

        UNION ALL

        SELECT 
          'SALES' as operation_type,
          'SHIPPED' as sub_type,
          COUNT(*) as transaction_count,
          SUM(JSON_EXTRACT(es.event_data, '$.quantity')) as total_quantity,
          AVG(JSON_EXTRACT(es.event_data, '$.unitPrice')) as avg_unit_cost,
          MIN(es.created_at) as first_date,
          MAX(es.created_at) as last_date,
          ip.warehouse_id,
          w.name as warehouse_name
        FROM event_store es
        JOIN inventory_projections ip ON JSON_EXTRACT(es.event_data, '$.itemId') = ip.item_id 
          AND JSON_EXTRACT(es.event_data, '$.warehouseId') = ip.warehouse_id
        LEFT JOIN warehouses w ON ip.warehouse_id = w.id
        WHERE es.institution_id = ? 
          AND JSON_EXTRACT(es.event_data, '$.itemId') = ?
          ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
          AND es.event_type = 'SALE_SHIPPED'
        GROUP BY ip.warehouse_id, w.name

        UNION ALL

        SELECT 
          'ADJUSTMENT' as operation_type,
          ia.adjustment_type as sub_type,
          COUNT(*) as transaction_count,
          SUM(CASE WHEN ia.adjustment_type = 'increase' THEN ia.quantity_change ELSE -ia.quantity_change END) as total_quantity,
          NULL as avg_unit_cost,
          MIN(ia.created_at) as first_date,
          MAX(ia.created_at) as last_date,
          ia.warehouse_id,
          w.name as warehouse_name
        FROM inventory_adjustments ia
        LEFT JOIN warehouses w ON ia.warehouse_id = w.id
        WHERE ia.institution_id = ? 
          AND ia.item_id = ?
          ${warehouseId ? 'AND ia.warehouse_id = ?' : ''}
        GROUP BY ia.warehouse_id, w.name, ia.adjustment_type

        UNION ALL

        SELECT 
          'RETURN' as operation_type,
          'SALE_RETURNED' as sub_type,
          COUNT(*) as transaction_count,
          SUM(JSON_EXTRACT(es.event_data, '$.quantity')) as total_quantity,
          AVG(JSON_EXTRACT(es.event_data, '$.unitPrice')) as avg_unit_cost,
          MIN(es.created_at) as first_date,
          MAX(es.created_at) as last_date,
          ip.warehouse_id,
          w.name as warehouse_name
        FROM event_store es
        JOIN inventory_projections ip ON JSON_EXTRACT(es.event_data, '$.itemId') = ip.item_id 
          AND JSON_EXTRACT(es.event_data, '$.warehouseId') = ip.warehouse_id
        LEFT JOIN warehouses w ON ip.warehouse_id = w.id
        WHERE es.institution_id = ? 
          AND JSON_EXTRACT(es.event_data, '$.itemId') = ?
          ${warehouseId ? 'AND ip.warehouse_id = ?' : ''}
          AND es.event_type = 'SALE_RETURNED'
        GROUP BY ip.warehouse_id, w.name

        ORDER BY warehouse_id, operation_type`,
        warehouseId 
          ? [institutionId, itemId, warehouseId, institutionId, itemId, warehouseId, institutionId, itemId, warehouseId, institutionId, itemId, warehouseId, institutionId, itemId, warehouseId]
          : [institutionId, itemId, institutionId, itemId, institutionId, itemId, institutionId, itemId, institutionId, itemId]
      );

      // Format the response
      const summary = currentStock.map(stock => {
        const warehouseActivities = activities.filter(a => a.warehouse_id === stock.warehouse_id);
        
        const purchased = warehouseActivities
          .filter(a => a.operation_type === 'PURCHASE' && a.sub_type === 'RECEIVED')
          .reduce((sum, a) => sum + Number(a.total_quantity || 0), 0);

        const reserved = warehouseActivities
          .filter(a => a.operation_type === 'SALES' && a.sub_type === 'RESERVED')
          .reduce((sum, a) => sum + Number(a.total_quantity || 0), 0);

        const shipped = warehouseActivities
          .filter(a => a.operation_type === 'SALES' && a.sub_type === 'SHIPPED')
          .reduce((sum, a) => sum + Number(a.total_quantity || 0), 0);

        const adjustedIn = warehouseActivities
          .filter(a => a.operation_type === 'ADJUSTMENT' && a.sub_type === 'increase')
          .reduce((sum, a) => sum + Number(a.total_quantity || 0), 0);

        const adjustedOut = warehouseActivities
          .filter(a => a.operation_type === 'ADJUSTMENT' && a.sub_type === 'decrease')
          .reduce((sum, a) => sum + Math.abs(Number(a.total_quantity || 0)), 0);

        const returned = warehouseActivities
          .filter(a => a.operation_type === 'RETURN')
          .reduce((sum, a) => sum + Number(a.total_quantity || 0), 0);

        return {
          item_id: stock.item_id,
          sku: stock.sku,
          item_name: stock.item_name,
          unit: stock.unit,
          warehouse_id: stock.warehouse_id,
          warehouse_name: stock.warehouse_name,
          current_stock: {
            quantity_on_hand: Number(stock.quantity_on_hand),
            quantity_available: Number(stock.quantity_available),
            quantity_reserved: Number(stock.quantity_reserved),
            average_cost: Number(stock.average_cost),
            total_value: Number(stock.total_value)
          },
          operations_summary: {
            purchased: { quantity: purchased, description: `${purchased} units received from purchases` },
            shipped: { quantity: shipped, description: `${shipped} units shipped to customers` },
            reserved: { quantity: reserved, description: `${reserved} units reserved for orders` },
            adjusted_in: { quantity: adjustedIn, description: `${adjustedIn} units added via adjustments` },
            adjusted_out: { quantity: adjustedOut, description: `${adjustedOut} units removed via adjustments` },
            returned: { quantity: returned, description: `${returned} units returned from customers` }
          },
          activity_details: warehouseActivities.map(a => ({
            operation: a.operation_type,
            type: a.sub_type,
            transaction_count: Number(a.transaction_count),
            total_quantity: Number(a.total_quantity || 0),
            avg_cost: a.avg_unit_cost ? Number(a.avg_unit_cost) : null,
            first_date: a.first_date,
            last_date: a.last_date
          }))
        };
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get item activity summary', { institutionId, itemId, error: error.message });
      throw error;
    }
  }

  async getDetailedItemLogs(institutionId, itemId, warehouseId = null, filters = {}) {
    try {
      const { startDate, endDate, operationType } = filters;
      
      let whereConditions = ['es.institution_id = ?', "JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.itemId')) = ?"];
      let params = [institutionId, itemId];

      if (warehouseId) {
        whereConditions.push("JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.warehouseId')) = ?");
        params.push(warehouseId);
      }

      if (startDate) {
        whereConditions.push('es.created_at >= ?');
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push('es.created_at <= ?');
        params.push(endDate);
      }

      if (operationType) {
        whereConditions.push('es.event_type LIKE ?');
        params.push(`%${operationType}%`);
      }

      const logs = await db.query(
        `SELECT 
          es.id,
          es.event_type,
          es.event_data,
          es.metadata,
          es.created_at,
          i.sku,
          i.name as item_name,
          w.name as warehouse_name,
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as performed_by
        FROM event_store es
        JOIN items i ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.itemId')) = i.id
        LEFT JOIN warehouses w ON JSON_UNQUOTE(JSON_EXTRACT(es.event_data, '$.warehouseId')) = w.id
        LEFT JOIN institution_users u ON JSON_UNQUOTE(JSON_EXTRACT(es.metadata, '$.userId')) = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY es.created_at DESC
        LIMIT 1000`,
        params
      );

      // Also get adjustment logs
      let adjWhereConditions = ['ia.institution_id = ?', 'ia.item_id = ?'];
      let adjParams = [institutionId, itemId];

      if (warehouseId) {
        adjWhereConditions.push('ia.warehouse_id = ?');
        adjParams.push(warehouseId);
      }

      if (startDate) {
        adjWhereConditions.push('ia.created_at >= ?');
        adjParams.push(startDate);
      }

      if (endDate) {
        adjWhereConditions.push('ia.created_at <= ?');
        adjParams.push(endDate);
      }

      const adjustmentLogs = await db.query(
        `SELECT 
          ia.id,
          'ADJUSTMENT' as event_type,
          ia.adjustment_type,
          ia.quantity_change,
          ia.reason,
          ia.loss_type,
          ia.reference_number,
          ia.created_at,
          i.sku,
          i.name as item_name,
          w.name as warehouse_name,
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as performed_by
        FROM inventory_adjustments ia
        JOIN items i ON ia.item_id = i.id
        LEFT JOIN warehouses w ON ia.warehouse_id = w.id
        LEFT JOIN institution_users u ON ia.adjusted_by = u.id
        WHERE ${adjWhereConditions.join(' AND ')}
        ORDER BY ia.created_at DESC
        LIMIT 1000`,
        adjParams
      );

      const auditLogs = await db.query(
        `SELECT
          al.id,
          al.action,
          al.changes,
          al.request_body,
          al.description,
          al.created_at,
          CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as performed_by
         FROM audit_logs al
         LEFT JOIN institution_users u ON al.user_id = u.id AND u.institution_id = al.institution_id
         WHERE al.institution_id = ?
           AND al.entity_type = 'item'
           AND al.entity_id = ?
           AND al.action IN ('item_created', 'item_updated', 'item_deleted', 'item_components_updated')
         ORDER BY al.created_at DESC
         LIMIT 1000`,
        [institutionId, itemId]
      );

      // Combine and format logs
      const allLogs = [
        ...logs.map(log => ({
          id: log.id,
          type: log.event_type,
          quantity: (() => { try { const d = typeof log.event_data === 'object' ? log.event_data : JSON.parse(log.event_data); return d.quantity; } catch { return null; } })(),
          reference: (() => { try { const d = typeof log.event_data === 'object' ? log.event_data : JSON.parse(log.event_data); return d.poId || d.soId || d.grnNumber || d.shipmentNumber || d.transferId || null; } catch { return null; } })(),
          warehouse: log.warehouse_name,
          performed_by: log.performed_by,
          timestamp: log.created_at,
          details: (() => { try { return typeof log.event_data === 'object' ? log.event_data : JSON.parse(log.event_data); } catch { return {}; } })()
        })),
        ...adjustmentLogs.map(log => ({
          id: log.id,
          type: 'ADJUSTMENT',
          sub_type: log.adjustment_type,
          quantity: log.quantity_change,
          reason: log.reason,
          loss_type: log.loss_type,
          reference: log.reference_number,
          warehouse: log.warehouse_name,
          performed_by: log.performed_by,
          timestamp: log.created_at
        })),
        ...auditLogs.map((log) => {
          const changes = parseJsonColumn(log.changes, {});
          const requestBody = parseJsonColumn(log.request_body, {});
          const serverSnapshot = changes?.serverSnapshot && typeof changes.serverSnapshot === 'object'
            ? changes.serverSnapshot
            : {};
          const before = serverSnapshot.before || null;
          const after = serverSnapshot.after || requestBody || null;
          const fieldChanges = buildItemAuditFieldChanges(log.action, before, after);

          return {
            id: `audit-${log.id}`,
            type: ITEM_AUDIT_EVENT_TYPES[log.action] || 'ITEM_UPDATED',
            audit_action: log.action,
            performed_by: (log.performed_by || '').trim(),
            timestamp: log.created_at,
            details: {
              before,
              after,
              requestBody
            },
            description: log.description,
            summary: buildItemAuditSummary(log.action, fieldChanges),
            field_changes: fieldChanges
          };
        })
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return allLogs;
    } catch (error) {
      logger.error('Failed to get detailed item logs', { institutionId, itemId, error: error.message });
      throw error;
    }
  }
}

module.exports = new ItemActivityService();
