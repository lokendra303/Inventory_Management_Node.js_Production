const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Bin statuses remain hardcoded intentionally: they are workflow states the
// application branches on (putaway / picking hide inactive/blocked/full bins).
// Zone types and bin types are user-customizable — see warehouse_zone_types
// and warehouse_bin_types tables.
// ─────────────────────────────────────────────────────────────────────────────
const BIN_STATUSES = ['active', 'inactive', 'blocked', 'full'];

async function getActiveTypeCodes(table, institutionId) {
  const rows = await db.query(
    `SELECT code FROM ${table}
      WHERE institution_id = ? AND status = 'active'`,
    [institutionId]
  );
  return rows.map((r) => r.code);
}

async function assertZoneTypeExists(institutionId, code) {
  const [row] = await db.query(
    `SELECT code FROM warehouse_zone_types
      WHERE institution_id = ? AND code = ? AND status = 'active' LIMIT 1`,
    [institutionId, code]
  );
  if (!row) throw new Error(`Invalid zoneType "${code}" — not defined for this institution`);
}

async function assertBinTypeExists(institutionId, code) {
  const [row] = await db.query(
    `SELECT code FROM warehouse_bin_types
      WHERE institution_id = ? AND code = ? AND status = 'active' LIMIT 1`,
    [institutionId, code]
  );
  if (!row) throw new Error(`Invalid binType "${code}" — not defined for this institution`);
}

function requireNonEmpty(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`${field} is required`);
  }
}

async function assertWarehouseExists(institutionId, warehouseId) {
  const [wh] = await db.query(
    'SELECT id FROM warehouses WHERE institution_id = ? AND id = ?',
    [institutionId, warehouseId]
  );
  if (!wh) throw new Error('Warehouse not found');
}

class WarehouseLocationService {
  // ───────────────────────── Zones ─────────────────────────
  async createZone(institutionId, data, userId) {
    const { warehouseId, code, name, description, zoneType } = data;
    requireNonEmpty(warehouseId, 'warehouseId');
    requireNonEmpty(code, 'code');
    requireNonEmpty(name, 'name');
    if (zoneType) {
      await assertZoneTypeExists(institutionId, zoneType);
    }

    await assertWarehouseExists(institutionId, warehouseId);

    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO warehouse_zones
           (id, institution_id, warehouse_id, code, name, description, zone_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [id, institutionId, warehouseId, code.trim(), name.trim(), description || null, zoneType || 'storage']
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Zone code "${code}" already exists in this warehouse`);
      }
      throw err;
    }

    logger.info('Zone created', { id, institutionId, warehouseId, userId });
    return id;
  }

  async getZones(institutionId, filters = {}) {
    const clauses = ['z.institution_id = ?'];
    const params = [institutionId];

    if (filters.warehouseId) {
      clauses.push('z.warehouse_id = ?');
      params.push(filters.warehouseId);
    }
    if (filters.status && filters.status !== 'all') {
      clauses.push('z.status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      clauses.push('(z.code LIKE ? OR z.name LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const rows = await db.query(
      `SELECT z.*, w.name AS warehouse_name, w.code AS warehouse_code,
              (SELECT COUNT(*) FROM warehouse_racks r WHERE r.zone_id = z.id) AS rack_count,
              (SELECT COUNT(*) FROM warehouse_bins b WHERE b.zone_id = z.id) AS bin_count
         FROM warehouse_zones z
         JOIN warehouses w ON w.id = z.warehouse_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY w.name, z.name`,
      params
    );
    return rows;
  }

  async updateZone(institutionId, zoneId, data, userId) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.zoneType !== undefined) {
      await assertZoneTypeExists(institutionId, data.zoneType);
      fields.push('zone_type = ?'); values.push(data.zoneType);
    }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

    if (fields.length === 0) throw new Error('No fields to update');
    fields.push('updated_at = NOW()');

    try {
      const result = await db.query(
        `UPDATE warehouse_zones SET ${fields.join(', ')}
          WHERE institution_id = ? AND id = ?`,
        [...values, institutionId, zoneId]
      );
      if (result.affectedRows === 0) throw new Error('Zone not found');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Zone code "${data.code}" already exists in this warehouse`);
      }
      throw err;
    }

    logger.info('Zone updated', { zoneId, institutionId, userId });
  }

  async deleteZone(institutionId, zoneId, userId) {
    const result = await db.query(
      `DELETE FROM warehouse_zones WHERE institution_id = ? AND id = ?`,
      [institutionId, zoneId]
    );
    if (result.affectedRows === 0) throw new Error('Zone not found');
    logger.info('Zone deleted', { zoneId, institutionId, userId });
  }

  // ───────────────────────── Racks ─────────────────────────
  async createRack(institutionId, data, userId) {
    const { zoneId, code, name, description, totalLevels, totalColumns } = data;
    requireNonEmpty(zoneId, 'zoneId');
    requireNonEmpty(code, 'code');
    requireNonEmpty(name, 'name');

    const [zone] = await db.query(
      'SELECT warehouse_id FROM warehouse_zones WHERE institution_id = ? AND id = ?',
      [institutionId, zoneId]
    );
    if (!zone) throw new Error('Zone not found');

    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO warehouse_racks
           (id, institution_id, warehouse_id, zone_id, code, name, description, total_levels, total_columns, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          id, institutionId, zone.warehouse_id, zoneId,
          code.trim(), name.trim(), description || null,
          Number.isFinite(Number(totalLevels)) ? Number(totalLevels) : 1,
          Number.isFinite(Number(totalColumns)) ? Number(totalColumns) : 1,
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Rack code "${code}" already exists in this zone`);
      }
      throw err;
    }

    logger.info('Rack created', { id, institutionId, zoneId, userId });
    return id;
  }

  async getRacks(institutionId, filters = {}) {
    const clauses = ['r.institution_id = ?'];
    const params = [institutionId];

    if (filters.warehouseId) {
      clauses.push('r.warehouse_id = ?');
      params.push(filters.warehouseId);
    }
    if (filters.zoneId) {
      clauses.push('r.zone_id = ?');
      params.push(filters.zoneId);
    }
    if (filters.status && filters.status !== 'all') {
      clauses.push('r.status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      clauses.push('(r.code LIKE ? OR r.name LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const rows = await db.query(
      `SELECT r.*, z.name AS zone_name, z.code AS zone_code,
              w.name AS warehouse_name, w.code AS warehouse_code,
              (SELECT COUNT(*) FROM warehouse_bins b WHERE b.rack_id = r.id) AS bin_count
         FROM warehouse_racks r
         JOIN warehouse_zones z ON z.id = r.zone_id
         JOIN warehouses w ON w.id = r.warehouse_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY w.name, z.name, r.name`,
      params
    );
    return rows;
  }

  async updateRack(institutionId, rackId, data, userId) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.totalLevels !== undefined) { fields.push('total_levels = ?'); values.push(Number(data.totalLevels) || 1); }
    if (data.totalColumns !== undefined) { fields.push('total_columns = ?'); values.push(Number(data.totalColumns) || 1); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

    if (fields.length === 0) throw new Error('No fields to update');
    fields.push('updated_at = NOW()');

    try {
      const result = await db.query(
        `UPDATE warehouse_racks SET ${fields.join(', ')}
          WHERE institution_id = ? AND id = ?`,
        [...values, institutionId, rackId]
      );
      if (result.affectedRows === 0) throw new Error('Rack not found');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Rack code "${data.code}" already exists in this zone`);
      }
      throw err;
    }

    logger.info('Rack updated', { rackId, institutionId, userId });
  }

  async deleteRack(institutionId, rackId, userId) {
    const result = await db.query(
      `DELETE FROM warehouse_racks WHERE institution_id = ? AND id = ?`,
      [institutionId, rackId]
    );
    if (result.affectedRows === 0) throw new Error('Rack not found');
    logger.info('Rack deleted', { rackId, institutionId, userId });
  }

  // ───────────────────────── Bins ─────────────────────────
  async createBin(institutionId, data, userId) {
    const {
      rackId, code, name, binLevel, binColumn,
      binType, capacityQty, capacityUnit, barcode, isDefault, status,
    } = data;
    requireNonEmpty(rackId, 'rackId');
    requireNonEmpty(code, 'code');
    if (binType) {
      await assertBinTypeExists(institutionId, binType);
    }
    if (status && !BIN_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${BIN_STATUSES.join(', ')}`);
    }

    const [rack] = await db.query(
      'SELECT warehouse_id, zone_id FROM warehouse_racks WHERE institution_id = ? AND id = ?',
      [institutionId, rackId]
    );
    if (!rack) throw new Error('Rack not found');

    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO warehouse_bins
           (id, institution_id, warehouse_id, zone_id, rack_id, code, name,
            bin_level, bin_column, bin_type, capacity_qty, capacity_unit,
            barcode, is_default, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, institutionId, rack.warehouse_id, rack.zone_id, rackId,
          code.trim(), name || null,
          binLevel != null ? Number(binLevel) : null,
          binColumn != null ? Number(binColumn) : null,
          binType || 'standard',
          capacityQty != null && capacityQty !== '' ? Number(capacityQty) : null,
          capacityUnit || null,
          barcode || null,
          isDefault ? 1 : 0,
          status || 'active',
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Bin code "${code}" already exists in this rack`);
      }
      throw err;
    }

    logger.info('Bin created', { id, institutionId, rackId, userId });
    return id;
  }

  async getBins(institutionId, filters = {}) {
    const clauses = ['b.institution_id = ?'];
    const params = [institutionId];

    if (filters.warehouseId) {
      clauses.push('b.warehouse_id = ?');
      params.push(filters.warehouseId);
    }
    if (filters.zoneId) {
      clauses.push('b.zone_id = ?');
      params.push(filters.zoneId);
    }
    if (filters.rackId) {
      clauses.push('b.rack_id = ?');
      params.push(filters.rackId);
    }
    if (filters.status && filters.status !== 'all') {
      clauses.push('b.status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      clauses.push('(b.code LIKE ? OR b.name LIKE ? OR b.barcode LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    // mysql2 prepared-statement binding of LIMIT/OFFSET is broken in some
    // driver versions ("Incorrect arguments to mysqld_stmt_execute"), so we
    // inline them as validated integers instead of using ? placeholders.
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 500, 1), 2000);
    const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);

    const rows = await db.query(
      `SELECT b.*, r.name AS rack_name, r.code AS rack_code,
              z.name AS zone_name, z.code AS zone_code,
              w.name AS warehouse_name, w.code AS warehouse_code
         FROM warehouse_bins b
         JOIN warehouse_racks r ON r.id = b.rack_id
         JOIN warehouse_zones z ON z.id = b.zone_id
         JOIN warehouses w ON w.id = b.warehouse_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY w.name, z.name, r.name, b.bin_level, b.bin_column, b.code
        LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    return rows;
  }

  async getBinById(institutionId, binId) {
    const [row] = await db.query(
      `SELECT b.*, r.name AS rack_name, r.code AS rack_code,
              z.name AS zone_name, z.code AS zone_code,
              w.name AS warehouse_name, w.code AS warehouse_code
         FROM warehouse_bins b
         JOIN warehouse_racks r ON r.id = b.rack_id
         JOIN warehouse_zones z ON z.id = b.zone_id
         JOIN warehouses w ON w.id = b.warehouse_id
        WHERE b.institution_id = ? AND b.id = ?`,
      [institutionId, binId]
    );
    return row || null;
  }

  async updateBin(institutionId, binId, data, userId) {
    const fields = [];
    const values = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
    if (data.binLevel !== undefined) { fields.push('bin_level = ?'); values.push(data.binLevel != null ? Number(data.binLevel) : null); }
    if (data.binColumn !== undefined) { fields.push('bin_column = ?'); values.push(data.binColumn != null ? Number(data.binColumn) : null); }
    if (data.binType !== undefined) {
      await assertBinTypeExists(institutionId, data.binType);
      fields.push('bin_type = ?'); values.push(data.binType);
    }
    if (data.capacityQty !== undefined) { fields.push('capacity_qty = ?'); values.push(data.capacityQty != null && data.capacityQty !== '' ? Number(data.capacityQty) : null); }
    if (data.capacityUnit !== undefined) { fields.push('capacity_unit = ?'); values.push(data.capacityUnit || null); }
    if (data.barcode !== undefined) { fields.push('barcode = ?'); values.push(data.barcode || null); }
    if (data.isDefault !== undefined) { fields.push('is_default = ?'); values.push(data.isDefault ? 1 : 0); }
    if (data.status !== undefined) {
      if (!BIN_STATUSES.includes(data.status)) {
        throw new Error(`Invalid status. Must be one of: ${BIN_STATUSES.join(', ')}`);
      }
      fields.push('status = ?'); values.push(data.status);
    }

    if (fields.length === 0) throw new Error('No fields to update');
    fields.push('updated_at = NOW()');

    try {
      const result = await db.query(
        `UPDATE warehouse_bins SET ${fields.join(', ')}
          WHERE institution_id = ? AND id = ?`,
        [...values, institutionId, binId]
      );
      if (result.affectedRows === 0) throw new Error('Bin not found');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Bin code "${data.code}" already exists in this rack`);
      }
      throw err;
    }

    logger.info('Bin updated', { binId, institutionId, userId });
  }

  async deleteBin(institutionId, binId, userId) {
    // Null-out any item.default_bin_id references first so we don't leave
    // dangling pointers when a bin is removed.
    await db.query(
      `UPDATE items SET default_bin_id = NULL
        WHERE institution_id = ? AND default_bin_id = ?`,
      [institutionId, binId]
    );

    const result = await db.query(
      `DELETE FROM warehouse_bins WHERE institution_id = ? AND id = ?`,
      [institutionId, binId]
    );
    if (result.affectedRows === 0) throw new Error('Bin not found');
    logger.info('Bin deleted', { binId, institutionId, userId });
  }

  /**
   * Import many bins at once. Rows may supply either `rackId` OR the natural
   * keys (`warehouseCode`/`zoneCode`/`rackCode`). Parent zones / racks are
   * auto-created when missing so a single CSV can seed a full hierarchy.
   *
   * Returns { created, skipped, errors: [{row, error}] }.
   */
  async importBins(institutionId, rows, userId) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No rows provided');
    }
    if (rows.length > 5000) {
      throw new Error('Import limited to 5000 rows per request');
    }

    const result = { created: 0, skipped: 0, errors: [] };

    // Cache of (warehouseCode) -> warehouseId and (warehouseId|zoneCode) -> zoneId, etc.
    const whCache = new Map();
    const zoneCache = new Map();
    const rackCache = new Map();

    // Pre-load active type codes once per batch (cheap, avoids per-row queries).
    const validBinTypes = new Set(await getActiveTypeCodes('warehouse_bin_types', institutionId));
    const validZoneTypes = new Set(await getActiveTypeCodes('warehouse_zone_types', institutionId));
    const defaultBinType = validBinTypes.has('standard') ? 'standard' : (validBinTypes.values().next().value || 'standard');
    const defaultZoneType = validZoneTypes.has('storage') ? 'storage' : (validZoneTypes.values().next().value || 'storage');

    const resolveWarehouse = async (code) => {
      if (!code) return null;
      if (whCache.has(code)) return whCache.get(code);
      const [wh] = await db.query(
        'SELECT id FROM warehouses WHERE institution_id = ? AND code = ? LIMIT 1',
        [institutionId, code]
      );
      const id = wh ? wh.id : null;
      whCache.set(code, id);
      return id;
    };

    const resolveZone = async (warehouseId, code, createIfMissing) => {
      const key = `${warehouseId}|${code}`;
      if (zoneCache.has(key)) return zoneCache.get(key);
      const [z] = await db.query(
        `SELECT id FROM warehouse_zones
          WHERE institution_id = ? AND warehouse_id = ? AND code = ? LIMIT 1`,
        [institutionId, warehouseId, code]
      );
      let id = z ? z.id : null;
      if (!id && createIfMissing) {
        id = uuidv4();
        await db.query(
          `INSERT INTO warehouse_zones
             (id, institution_id, warehouse_id, code, name, zone_type, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [id, institutionId, warehouseId, code, code, defaultZoneType]
        );
      }
      zoneCache.set(key, id);
      return id;
    };

    const resolveRack = async (warehouseId, zoneId, code, createIfMissing) => {
      const key = `${zoneId}|${code}`;
      if (rackCache.has(key)) return rackCache.get(key);
      const [r] = await db.query(
        `SELECT id FROM warehouse_racks
          WHERE institution_id = ? AND zone_id = ? AND code = ? LIMIT 1`,
        [institutionId, zoneId, code]
      );
      let id = r ? r.id : null;
      if (!id && createIfMissing) {
        id = uuidv4();
        await db.query(
          `INSERT INTO warehouse_racks
             (id, institution_id, warehouse_id, zone_id, code, name, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [id, institutionId, warehouseId, zoneId, code, code]
        );
      }
      rackCache.set(key, id);
      return id;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      try {
        let rackId = row.rackId;
        let warehouseId;
        let zoneId;

        if (rackId) {
          const [r] = await db.query(
            'SELECT warehouse_id, zone_id FROM warehouse_racks WHERE institution_id = ? AND id = ? LIMIT 1',
            [institutionId, rackId]
          );
          if (!r) throw new Error(`rackId "${rackId}" not found`);
          warehouseId = r.warehouse_id;
          zoneId = r.zone_id;
        } else {
          const whCode = (row.warehouseCode || '').toString().trim();
          const zoneCode = (row.zoneCode || '').toString().trim();
          const rackCode = (row.rackCode || '').toString().trim();
          if (!whCode || !zoneCode || !rackCode) {
            throw new Error('Provide rackId or warehouseCode+zoneCode+rackCode');
          }
          warehouseId = await resolveWarehouse(whCode);
          if (!warehouseId) throw new Error(`Warehouse "${whCode}" not found`);
          zoneId = await resolveZone(warehouseId, zoneCode, true);
          rackId = await resolveRack(warehouseId, zoneId, rackCode, true);
        }

        const code = (row.code || row.binCode || '').toString().trim();
        if (!code) throw new Error('Bin code is required');

        const binType = row.binType && validBinTypes.has(row.binType) ? row.binType : defaultBinType;
        const status = row.status && BIN_STATUSES.includes(row.status) ? row.status : 'active';

        try {
          await db.query(
            `INSERT INTO warehouse_bins
               (id, institution_id, warehouse_id, zone_id, rack_id, code, name,
                bin_level, bin_column, bin_type, capacity_qty, capacity_unit,
                barcode, is_default, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(), institutionId, warehouseId, zoneId, rackId,
              code, row.name || null,
              row.binLevel != null && row.binLevel !== '' ? Number(row.binLevel) : null,
              row.binColumn != null && row.binColumn !== '' ? Number(row.binColumn) : null,
              binType,
              row.capacityQty != null && row.capacityQty !== '' ? Number(row.capacityQty) : null,
              row.capacityUnit || null,
              row.barcode || null,
              row.isDefault === true || row.isDefault === 'true' || row.isDefault === 1 ? 1 : 0,
              status,
            ]
          );
          result.created += 1;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            result.skipped += 1;
          } else {
            throw err;
          }
        }
      } catch (err) {
        result.errors.push({ row: i + 1, error: err.message });
      }
    }

    logger.info('Bin import completed', {
      institutionId, userId,
      created: result.created, skipped: result.skipped, errors: result.errors.length,
    });
    return result;
  }

  /**
   * Summary used by the tree/overview UI: counts aggregated per level.
   */
  async getWarehouseHierarchy(institutionId, warehouseId) {
    await assertWarehouseExists(institutionId, warehouseId);

    const zones = await db.query(
      `SELECT z.*, 
              (SELECT COUNT(*) FROM warehouse_racks r WHERE r.zone_id = z.id) AS rack_count,
              (SELECT COUNT(*) FROM warehouse_bins b WHERE b.zone_id = z.id) AS bin_count
         FROM warehouse_zones z
        WHERE z.institution_id = ? AND z.warehouse_id = ?
        ORDER BY z.name`,
      [institutionId, warehouseId]
    );

    const racks = zones.length
      ? await db.query(
          `SELECT r.*, 
                  (SELECT COUNT(*) FROM warehouse_bins b WHERE b.rack_id = r.id) AS bin_count
             FROM warehouse_racks r
            WHERE r.institution_id = ? AND r.warehouse_id = ?
            ORDER BY r.name`,
          [institutionId, warehouseId]
        )
      : [];

    const bins = racks.length
      ? await db.query(
          `SELECT * FROM warehouse_bins
            WHERE institution_id = ? AND warehouse_id = ?
            ORDER BY bin_level, bin_column, code`,
          [institutionId, warehouseId]
        )
      : [];

    const racksByZone = new Map();
    for (const r of racks) {
      if (!racksByZone.has(r.zone_id)) racksByZone.set(r.zone_id, []);
      racksByZone.get(r.zone_id).push(r);
    }
    const binsByRack = new Map();
    for (const b of bins) {
      if (!binsByRack.has(b.rack_id)) binsByRack.set(b.rack_id, []);
      binsByRack.get(b.rack_id).push(b);
    }

    return zones.map((z) => ({
      ...z,
      racks: (racksByZone.get(z.id) || []).map((r) => ({
        ...r,
        bins: binsByRack.get(r.id) || [],
      })),
    }));
  }

  // ───────────────────── Type catalogs (zone / bin) ─────────────────────
  // Generic implementation used for both warehouse_zone_types and
  // warehouse_bin_types. The two tables share an identical shape.

  async _listTypeCatalog(table, institutionId, { status } = {}) {
    const clauses = ['institution_id = ?'];
    const params = [institutionId];
    if (status && status !== 'all') {
      clauses.push('status = ?');
      params.push(status);
    }
    return db.query(
      `SELECT id, code, name, description, is_system, sort_order, status,
              created_at, updated_at
         FROM ${table}
        WHERE ${clauses.join(' AND ')}
        ORDER BY sort_order, name`,
      params
    );
  }

  async _createTypeCatalog(table, institutionId, data, userId) {
    const { code, name, description, sortOrder } = data;
    requireNonEmpty(code, 'code');
    requireNonEmpty(name, 'name');

    const normalizedCode = String(code).trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_-]{1,50}$/.test(normalizedCode)) {
      throw new Error('Code must be 1–50 chars: letters, digits, underscore, dash');
    }

    const id = uuidv4();
    try {
      await db.query(
        `INSERT INTO ${table}
           (id, institution_id, code, name, description, is_system, sort_order, status)
         VALUES (?, ?, ?, ?, ?, 0, ?, 'active')`,
        [
          id, institutionId, normalizedCode, name.trim(),
          description || null,
          Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        ]
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Code "${normalizedCode}" already exists`);
      }
      throw err;
    }
    logger.info(`${table} created`, { id, institutionId, userId, code: normalizedCode });
    return id;
  }

  async _updateTypeCatalog(table, institutionId, id, data, userId) {
    const [existing] = await db.query(
      `SELECT id, code, is_system FROM ${table}
        WHERE institution_id = ? AND id = ? LIMIT 1`,
      [institutionId, id]
    );
    if (!existing) throw new Error('Type not found');

    const fields = [];
    const values = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(String(data.name).trim()); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description || null); }
    if (data.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(Number(data.sortOrder) || 0); }

    if (data.status !== undefined) {
      if (!['active', 'inactive'].includes(data.status)) {
        throw new Error('status must be active or inactive');
      }
      fields.push('status = ?'); values.push(data.status);
    }

    // `code` is immutable for system rows; editable for user rows (but still
    // normalized + uniqueness-checked).
    if (data.code !== undefined && !existing.is_system) {
      const normalizedCode = String(data.code).trim().toLowerCase().replace(/\s+/g, '_');
      if (!/^[a-z0-9_-]{1,50}$/.test(normalizedCode)) {
        throw new Error('Code must be 1–50 chars: letters, digits, underscore, dash');
      }
      fields.push('code = ?'); values.push(normalizedCode);
    } else if (data.code !== undefined && existing.is_system && data.code !== existing.code) {
      throw new Error('Built-in types cannot change their code');
    }

    if (fields.length === 0) throw new Error('No fields to update');
    fields.push('updated_at = NOW()');

    try {
      const result = await db.query(
        `UPDATE ${table} SET ${fields.join(', ')}
          WHERE institution_id = ? AND id = ?`,
        [...values, institutionId, id]
      );
      if (result.affectedRows === 0) throw new Error('Type not found');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new Error(`Code "${data.code}" already exists`);
      }
      throw err;
    }
    logger.info(`${table} updated`, { id, institutionId, userId });
  }

  async _deleteTypeCatalog(table, usageTable, usageColumn, institutionId, id, userId) {
    const [existing] = await db.query(
      `SELECT code, is_system FROM ${table}
        WHERE institution_id = ? AND id = ? LIMIT 1`,
      [institutionId, id]
    );
    if (!existing) throw new Error('Type not found');
    if (existing.is_system) {
      throw new Error('Built-in types cannot be deleted. Set status to inactive instead.');
    }

    const [{ in_use: inUse }] = await db.query(
      `SELECT COUNT(*) AS in_use FROM ${usageTable}
        WHERE institution_id = ? AND ${usageColumn} = ?`,
      [institutionId, existing.code]
    );
    if (inUse > 0) {
      throw new Error(`Cannot delete: used by ${inUse} row(s). Set status to inactive, or reassign them first.`);
    }

    await db.query(
      `DELETE FROM ${table} WHERE institution_id = ? AND id = ?`,
      [institutionId, id]
    );
    logger.info(`${table} deleted`, { id, institutionId, userId });
  }

  // Zone types — thin wrappers around the generic helpers.
  listZoneTypes(institutionId, filters)       { return this._listTypeCatalog('warehouse_zone_types', institutionId, filters); }
  createZoneType(institutionId, data, userId) { return this._createTypeCatalog('warehouse_zone_types', institutionId, data, userId); }
  updateZoneType(institutionId, id, data, userId) { return this._updateTypeCatalog('warehouse_zone_types', institutionId, id, data, userId); }
  deleteZoneType(institutionId, id, userId)   { return this._deleteTypeCatalog('warehouse_zone_types', 'warehouse_zones', 'zone_type', institutionId, id, userId); }

  // Bin types.
  listBinTypes(institutionId, filters)       { return this._listTypeCatalog('warehouse_bin_types', institutionId, filters); }
  createBinType(institutionId, data, userId) { return this._createTypeCatalog('warehouse_bin_types', institutionId, data, userId); }
  updateBinType(institutionId, id, data, userId) { return this._updateTypeCatalog('warehouse_bin_types', institutionId, id, data, userId); }
  deleteBinType(institutionId, id, userId)   { return this._deleteTypeCatalog('warehouse_bin_types', 'warehouse_bins', 'bin_type', institutionId, id, userId); }

  /**
   * Used by the GET /constants endpoint. Replaces the old hardcoded lists.
   * Only active rows are returned so UI selects show a clean set.
   */
  async getConstants(institutionId) {
    const [zoneTypes, binTypes] = await Promise.all([
      this.listZoneTypes(institutionId, { status: 'active' }),
      this.listBinTypes(institutionId, { status: 'active' }),
    ]);
    return {
      zoneTypes: zoneTypes.map((r) => ({ code: r.code, name: r.name })),
      binTypes:  binTypes.map((r) => ({ code: r.code, name: r.name })),
      binStatuses: BIN_STATUSES,
    };
  }
}

const instance = new WarehouseLocationService();
instance.BIN_STATUSES = BIN_STATUSES;

module.exports = instance;
