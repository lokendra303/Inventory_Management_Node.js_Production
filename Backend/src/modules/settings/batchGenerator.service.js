const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

const BATCH_CONTEXTS = new Set(['general', 'kit_assembly', 'kit_disassembly', 'opening_stock']);

const DEFAULT_RULES = {
  kit_assembly: {
    name: 'Kit assembly lot (default)',
    prefixStatic: 'ASM-{SKU}-{DATE}-{SEQ}',
    useDate: true,
    dateFormat: 'YYYYMMDD',
    useCounter: true,
    counterStart: 1,
    counterPadding: 3,
  },
  kit_disassembly: {
    name: 'Kit disassembly component lot (default)',
    prefixStatic: 'DSM-{SKU}-{DATE}-{SEQ}',
    useDate: true,
    dateFormat: 'YYYYMMDD',
    useCounter: true,
    counterStart: 1,
    counterPadding: 3,
  },
  opening_stock: {
    name: 'Opening stock lot (default)',
    prefixStatic: 'OPEN-{SKU}-{DATE}-{SEQ}',
    useDate: true,
    dateFormat: 'YYYYMMDD',
    useCounter: true,
    counterStart: 1,
    counterPadding: 3,
  },
};

/**
 * BatchGeneratorService — configurable batch/lot numbering (batch coding machine).
 * Same token template model as SKU rules: {SKU}, {ITEM}, {DATE}, {SEQ}, etc.
 */
class BatchGeneratorService {
  static DATE_FORMATS = new Set(['YY', 'YYMM', 'YYYYMM', 'YYYYMMDD']);

  async _exec(connection, sql, params) {
    if (connection) {
      const [rows] = await connection.execute(sql, params);
      return rows;
    }
    return db.query(sql, params);
  }

  async listRules(institutionId, filters = {}) {
    const context = filters.context ? String(filters.context) : null;
    let query = `SELECT * FROM batch_generator_rules
                 WHERE institution_id = ? AND status = 'active'`;
    const params = [institutionId];
    if (context && BATCH_CONTEXTS.has(context)) {
      query += ' AND context = ?';
      params.push(context);
    }
    query += ' ORDER BY context ASC, is_default DESC, scope_value ASC, name ASC';
    return this._exec(null, query, params);
  }

  async getRule(institutionId, id, connection = null) {
    const rows = await this._exec(
      connection,
      'SELECT * FROM batch_generator_rules WHERE institution_id = ? AND id = ?',
      [institutionId, id]
    );
    return rows[0] || null;
  }

  async buildContextFromItem(institutionId, itemId, warehouseId = null, connection = null) {
    const rows = await this._exec(
      connection,
      `SELECT id, sku, name, category, type, unit, brand, manufacturer, hsn_code, mpn, barcode
         FROM items
        WHERE institution_id = ? AND id = ?
        LIMIT 1`,
      [institutionId, itemId]
    );
    if (!rows.length) throw new Error('Item not found');

    const item = rows[0];
    let warehouseLabel = '';
    if (warehouseId) {
      const whRows = await this._exec(
        connection,
        'SELECT code, name FROM warehouses WHERE institution_id = ? AND id = ? LIMIT 1',
        [institutionId, warehouseId]
      );
      if (whRows.length) {
        warehouseLabel = whRows[0].code || whRows[0].name || '';
      }
    }

    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').trim();
    const category = String(item.category || '').trim();
    const unit = String(item.unit || '').trim();

    return {
      itemId,
      warehouseId: warehouseId || null,
      sku,
      name,
      item: name,
      category,
      type: item.type || '',
      unit,
      warehouse: warehouseLabel,
      brand: item.brand || '',
      manufacturer: item.manufacturer || '',
      hsnCode: item.hsn_code || '',
      mpn: item.mpn || '',
      barcode: item.barcode || '',
      skuCode: this._slug(sku, null),
      itemCode: this._slug(name, 4),
      categoryCode: this._abbr(category, 3),
      typeCode: this._slug(item.type, 3),
      unitCode: this._slug(unit, 4),
      warehouseCode: this._slug(warehouseLabel, 4),
      size: this._slug(unit, 8),
      typeValue: item.type || '',
    };
  }

  async resolveRule(institutionId, ctx = {}, connection = null) {
    const context = String(ctx.context || 'general');
    if (!BATCH_CONTEXTS.has(context)) {
      throw new Error(`Invalid batch rule context: ${context}`);
    }

    if (ctx?.ruleId) {
      const byId = await this._exec(
        connection,
        `SELECT * FROM batch_generator_rules
         WHERE institution_id = ? AND id = ? AND status = 'active' AND context = ?
         LIMIT 1`,
        [institutionId, ctx.ruleId, context]
      );
      if (byId.length > 0) return byId[0];
      throw new Error('Selected batch rule is unavailable. Please reselect a rule and try again.');
    }

    if (ctx?.category) {
      const byCat = await this._exec(
        connection,
        `SELECT * FROM batch_generator_rules
         WHERE institution_id = ? AND status = 'active' AND context = ?
           AND scope = 'category' AND LOWER(scope_value) = LOWER(?)
         LIMIT 1`,
        [institutionId, context, ctx.category]
      );
      if (byCat.length > 0) return byCat[0];
    }

    const def = await this._exec(
      connection,
      `SELECT * FROM batch_generator_rules
       WHERE institution_id = ? AND status = 'active' AND context = ? AND is_default = 1
       LIMIT 1`,
      [institutionId, context]
    );
    if (def[0]) return def[0];

    const secondary = await this._exec(
      connection,
      `SELECT * FROM batch_generator_rules
       WHERE institution_id = ? AND status = 'active' AND context = ? AND scope = 'default'
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [institutionId, context]
    );
    if (secondary[0]) return secondary[0];

    return this.ensureDefaultRule(institutionId, context, connection);
  }

  async ensureDefaultRule(institutionId, context, connection = null) {
    const cfg = DEFAULT_RULES[context];
    if (!cfg) return null;

    const existing = await this.resolveRuleWithoutBootstrap(institutionId, context, connection);
    if (existing) return existing;

    const newId = uuidv4();
    const insert = async (conn) => {
      await this._exec(
        conn,
        `INSERT INTO batch_generator_rules
         (id, institution_id, context, scope, scope_value, name,
          prefix_mode, prefix_static, prefix_source, prefix_length,
          \`separator\`, use_date, date_format,
          use_counter, counter_start, counter_current, counter_padding,
          is_default, status)
         VALUES (?, ?, ?, 'default', NULL, ?, 'static', ?, NULL, 3,
                 '-', ?, ?, ?, ?, ?, ?, 1, 'active')`,
        [
          newId, institutionId, context, cfg.name, cfg.prefixStatic,
          cfg.useDate ? 1 : 0, cfg.dateFormat,
          cfg.useCounter ? 1 : 0, cfg.counterStart,
          Math.max(0, cfg.counterStart - 1), cfg.counterPadding,
        ]
      );
    };

    if (connection) {
      await insert(connection);
    } else {
      await db.transaction(async (conn) => insert(conn));
    }

    logger.info('Default batch rule provisioned', { institutionId, context, id: newId });
    return this.getRule(institutionId, newId, connection);
  }

  async resolveRuleWithoutBootstrap(institutionId, context, connection = null) {
    const def = await this._exec(
      connection,
      `SELECT * FROM batch_generator_rules
       WHERE institution_id = ? AND status = 'active' AND context = ?
       ORDER BY is_default DESC, updated_at DESC
       LIMIT 1`,
      [institutionId, context]
    );
    return def[0] || null;
  }

  async upsertRule(institutionId, payload, userId) {
    const {
      id,
      context = 'general',
      name,
      scope = 'default',
      scopeValue = null,
      prefixMode = 'static',
      prefixStatic = '',
      prefixSource = null,
      prefixLength = 3,
      separator = '-',
      useDate = false,
      dateFormat = null,
      useCounter = true,
      counterStart = 1,
      counterPadding = 4,
      isDefault = false,
    } = payload || {};

    if (!BATCH_CONTEXTS.has(context)) throw new Error('Invalid batch rule context');
    const normalizedScopeValue = typeof scopeValue === 'string' ? scopeValue.trim() : scopeValue;
    const effectiveIsDefault = scope === 'default' ? !!isDefault : false;

    if (!name || !name.trim()) throw new Error('Rule name is required');
    if (!['default', 'category'].includes(scope)) throw new Error('Invalid scope');
    if (scope === 'category' && !normalizedScopeValue) throw new Error('Category name required for category scope');
    if (!['static', 'derived'].includes(prefixMode)) throw new Error('Invalid prefix mode');
    if (prefixMode === 'static' && !prefixStatic?.trim()) throw new Error('Static prefix cannot be empty');
    if (prefixMode === 'derived' && !prefixSource) throw new Error('Derived prefix needs a source field');
    if (useDate && !dateFormat) throw new Error('Date format required when date segment is enabled');
    if (useDate && !BatchGeneratorService.DATE_FORMATS.has(String(dateFormat).toUpperCase())) {
      throw new Error('Invalid date format. Use YY, YYMM, YYYYMM or YYYYMMDD');
    }
    if (!useCounter && !useDate && !String(prefixStatic || '').includes('{DATE}')) {
      throw new Error('Rule must include a counter or date segment to stay unique');
    }

    return db.transaction(async (connection) => {
      if (effectiveIsDefault) {
        await connection.execute(
          `UPDATE batch_generator_rules SET is_default = 0
           WHERE institution_id = ? AND context = ? AND (id <> ? OR ? IS NULL)`,
          [institutionId, context, id || '', id || null]
        );
      }

      if (id) {
        const [updated] = await connection.execute(
          `UPDATE batch_generator_rules
           SET name = ?, context = ?, scope = ?, scope_value = ?,
               prefix_mode = ?, prefix_static = ?, prefix_source = ?, prefix_length = ?,
               \`separator\` = ?, use_date = ?, date_format = ?,
               use_counter = ?, counter_start = ?, counter_padding = ?,
               is_default = ?, updated_at = NOW()
           WHERE institution_id = ? AND id = ?`,
          [
            name.trim(), context, scope, scope === 'category' ? normalizedScopeValue : null,
            prefixMode, prefixStatic || null, prefixSource, prefixLength,
            separator, useDate ? 1 : 0, dateFormat,
            useCounter ? 1 : 0, counterStart, counterPadding,
            effectiveIsDefault ? 1 : 0,
            institutionId, id,
          ]
        );
        if (!updated.affectedRows) throw new Error('Rule not found');
        return id;
      }

      const newId = uuidv4();
      await connection.execute(
        `INSERT INTO batch_generator_rules
         (id, institution_id, context, scope, scope_value, name,
          prefix_mode, prefix_static, prefix_source, prefix_length,
          \`separator\`, use_date, date_format,
          use_counter, counter_start, counter_current, counter_padding,
          is_default, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          newId, institutionId, context, scope, scope === 'category' ? normalizedScopeValue : null, name.trim(),
          prefixMode, prefixStatic || null, prefixSource, prefixLength,
          separator, useDate ? 1 : 0, dateFormat,
          useCounter ? 1 : 0, counterStart, Math.max(0, counterStart - 1), counterPadding,
          effectiveIsDefault ? 1 : 0,
        ]
      );
      logger.info('Batch rule created', { institutionId, id: newId, context, userId });
      return newId;
    });
  }

  async deleteRule(institutionId, id, userId) {
    const current = await this.getRule(institutionId, id);
    if (!current) throw new Error('Rule not found');

    const result = await db.query(
      `UPDATE batch_generator_rules SET status = 'inactive', updated_at = NOW()
       WHERE institution_id = ? AND id = ?`,
      [institutionId, id]
    );
    if (result.affectedRows === 0) throw new Error('Rule not found');
    logger.info('Batch rule archived', { institutionId, id, userId });
    return true;
  }

  async previewBatch(institutionId, ctx = {}, options = {}) {
    const context = String(ctx.context || 'general');
    const rule = await this.resolveRule(institutionId, { ...ctx, context }, options.connection);
    if (!rule) return { rule: null, preview: '' };
    const nextCounter = (Number(rule.counter_current) || 0) + 1;
    return {
      rule: {
        id: rule.id,
        name: rule.name,
        context: rule.context,
        scope: rule.scope,
        scope_value: rule.scope_value,
      },
      preview: this._format(rule, ctx, nextCounter),
    };
  }

  async generateBatch(institutionId, ctx = {}, options = {}) {
    const context = String(ctx.context || 'general');
    const rule = await this.resolveRule(institutionId, { ...ctx, context }, options.connection);
    if (!rule) {
      throw new Error('No batch rule configured. Create one under Batch coding rules first.');
    }

    const itemId = ctx.itemId;
    const warehouseId = ctx.warehouseId;
    if (!itemId || !warehouseId) {
      throw new Error('Item and warehouse are required to generate a batch number');
    }

    const run = async (connection) => {
      const bump = async () => {
        const [updated] = await connection.execute(
          `UPDATE batch_generator_rules
           SET counter_current = GREATEST(counter_current + 1, counter_start),
               updated_at = NOW()
           WHERE institution_id = ? AND id = ?`,
          [institutionId, rule.id]
        );
        if (!updated.affectedRows) throw new Error('Failed to bump batch counter');
        const [[row]] = await connection.execute(
          'SELECT counter_current AS n FROM batch_generator_rules WHERE id = ?',
          [rule.id]
        );
        return Number(row.n);
      };

      let nextCounter = rule.use_counter ? await bump() : null;
      let finalBatch = this._format(rule, ctx, nextCounter);

      let foundFree = false;
      for (let tries = 0; tries < 8; tries++) {
        const [dupe] = await connection.execute(
          `SELECT 1 AS x FROM item_batches
           WHERE institution_id = ? AND item_id = ? AND warehouse_id = ? AND batch_number = ?
           LIMIT 1`,
          [institutionId, itemId, warehouseId, finalBatch]
        );
        if (dupe.length === 0) {
          foundFree = true;
          break;
        }
        if (!rule.use_counter) {
          throw new Error(`Batch "${finalBatch}" already exists and rule has no counter`);
        }
        nextCounter = await bump();
        finalBatch = this._format(rule, ctx, nextCounter);
      }
      if (!foundFree) {
        throw new Error('Failed to allocate unique batch number; review batch coding rule settings');
      }

      return {
        batchNumber: finalBatch,
        ruleId: rule.id,
        ruleName: rule.name,
        counter: nextCounter,
      };
    };

    if (options.connection) {
      return run(options.connection);
    }
    return db.transaction(run);
  }

  _slug(raw, length) {
    if (!raw) return '';
    const clean = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
    return length ? clean.slice(0, length) : clean;
  }

  _abbr(raw, length = 10) {
    if (!raw) return '';
    const words = String(raw).trim().split(/[^A-Za-z0-9]+/g).filter(Boolean);
    if (!words.length) return '';
    return words.map((w) => w[0].toUpperCase()).join('').slice(0, Math.max(1, Number(length) || 10));
  }

  _templatePrefix(rule, ctx, counter) {
    const rawTemplate = String(rule.prefix_static || '');
    const datePart = this._datePart(rule);
    const counterPart = this._counterPart(rule, counter);
    const short = (v, n = 3) => this._slug(v, n);
    const full = (v) => this._slug(v, null);
    const extract = (value, len = 10, mode = 'abbr') => {
      const width = Math.max(1, Number(len) || 10);
      const m = String(mode || 'abbr').toLowerCase();
      if (m === 'slice' || m === 'chars') return this._slug(value, width);
      return this._abbr(value, width);
    };

    return rawTemplate.replace(/\{([^}]+)\}/g, (_, tokenExpr) => {
      const [rawToken, rawLen, rawMode] = String(tokenExpr || '').split('|').map((p) => String(p || '').trim());
      const t = String(rawToken || '').toUpperCase();
      switch (t) {
        case 'SKU': return full(ctx.sku || ctx.skuCode);
        case 'BRAND': return extract(ctx.brand, rawLen || 10, rawMode || 'abbr');
        case 'ITEM': return extract(ctx.item || ctx.name, rawLen || 10, rawMode || 'abbr');
        case 'NAME': return full(ctx.name);
        case 'CATEGORY': return extract(ctx.category, rawLen || 10, rawMode || 'abbr');
        case 'TYPE': return extract(ctx.type, rawLen || 10, rawMode || 'abbr');
        case 'UNIT': return extract(ctx.unit, rawLen || 10, rawMode || 'slice');
        case 'WAREHOUSE': return extract(ctx.warehouse, rawLen || 10, rawMode || 'slice');
        case 'HSN': return full(ctx.hsnCode || ctx.hsn);
        case 'MPN': return full(ctx.mpn);
        case 'BARCODE': return full(ctx.barcode);
        case 'DATE': return datePart;
        case 'SEQ':
        case 'COUNTER': return counterPart;
        default:
          return full(ctx[t.toLowerCase()] || ctx[rawToken] || '');
      }
    }).replace(/-{2,}/g, '-').replace(/(^-|-$)/g, '');
  }

  _prefix(rule, ctx, counter) {
    if (rule.prefix_mode === 'static') {
      if (String(rule.prefix_static || '').includes('{')) {
        return this._templatePrefix(rule, ctx, counter);
      }
      return this._slug(rule.prefix_static, null) || '';
    }
    const source = rule.prefix_source;
    const raw = source === 'category' ? ctx.category
      : source === 'brand' ? ctx.brand
      : source === 'sku' ? ctx.sku
      : source === 'name' ? ctx.name
      : '';
    return source === 'sku' ? this._slug(raw, null) : this._abbr(raw, rule.prefix_length || 3);
  }

  _datePart(rule) {
    if (!rule.use_date) return '';
    const d = new Date();
    const yyyy = d.getFullYear();
    const yy = String(yyyy).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    switch ((rule.date_format || '').toUpperCase()) {
      case 'YY': return yy;
      case 'YYMM': return `${yy}${mm}`;
      case 'YYYYMM': return `${yyyy}${mm}`;
      case 'YYYYMMDD': return `${yyyy}${mm}${dd}`;
      default: return '';
    }
  }

  _counterPart(rule, counter) {
    if (!rule.use_counter || counter == null) return '';
    const width = Math.max(1, Number(rule.counter_padding) || 4);
    return String(counter).padStart(width, '0');
  }

  _format(rule, ctx, counter) {
    if (rule.prefix_mode === 'static' && String(rule.prefix_static || '').includes('{')) {
      return this._prefix(rule, ctx, counter);
    }
    const parts = [
      this._prefix(rule, ctx, counter),
      this._datePart(rule),
      this._counterPart(rule, counter),
    ].filter(Boolean);
    return parts.join(rule.separator || '-');
  }
}

module.exports = new BatchGeneratorService();
