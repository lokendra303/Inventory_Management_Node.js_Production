const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const CodeTemplateEngine = require('../../utils/codeTemplateEngine');

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
      `SELECT i.id, i.sku, i.name, i.category, i.type, i.unit, i.brand, i.manufacturer,
              i.hsn_code, i.mpn, i.barcode, i.custom_fields,
              b.name AS brand_label,
              m.name AS manufacturer_label,
              u.symbol AS unit_symbol, u.name AS unit_name
         FROM items i
         LEFT JOIN brands b ON b.id = i.brand AND b.institution_id = i.institution_id
         LEFT JOIN manufacturers m ON m.id = i.manufacturer AND m.institution_id = i.institution_id
         LEFT JOIN units u ON u.id = i.unit AND u.institution_id = i.institution_id
        WHERE i.institution_id = ? AND i.id = ?
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

    const cf = this._safeParseJson(item.custom_fields, {});
    const skuMeta = cf.skuMeta && typeof cf.skuMeta === 'object' ? cf.skuMeta : {};
    const variant = this._extractMetaScalar(skuMeta.variant) || this._extractMetaScalar(cf.variant) || '';
    const color = this._extractMetaScalar(skuMeta.color) || this._extractMetaScalar(skuMeta.colour) || '';
    const size = this._extractMetaScalar(skuMeta.size) || this._extractMetaScalar(cf.size) || '';
    const packType = this._extractMetaScalar(skuMeta.packType) || this._extractMetaScalar(skuMeta.type) || '';

    const sku = String(item.sku || '').trim();
    const name = String(item.name || '').trim();
    const category = String(item.category || '').trim();
    const unitLabel = String(item.unit_symbol || item.unit_name || item.unit || '').trim();
    const brandName = String(item.brand_label || '').trim();
    const manufacturerName = String(item.manufacturer_label || '').trim();

    return {
      itemId,
      warehouseId: warehouseId || null,
      sku,
      name,
      item: name,
      category,
      type: item.type || '',
      unit: unitLabel,
      warehouse: warehouseLabel,
      brand: brandName,
      manufacturer: manufacturerName,
      variant,
      color,
      hsnCode: item.hsn_code || '',
      mpn: item.mpn || '',
      barcode: item.barcode || '',
      skuCode: CodeTemplateEngine.slug(sku, null),
      itemCode: CodeTemplateEngine.slug(name, 4),
      categoryCode: CodeTemplateEngine.abbr(category, 3),
      brandCode: CodeTemplateEngine.abbr(brandName, 3),
      manufacturerCode: CodeTemplateEngine.abbr(manufacturerName, 3),
      variantCode: CodeTemplateEngine.abbr(variant, 4),
      colorCode: CodeTemplateEngine.abbr(color, 4),
      typeCode: CodeTemplateEngine.slug(item.type, 3),
      unitCode: CodeTemplateEngine.slug(unitLabel, 4),
      warehouseCode: CodeTemplateEngine.slug(warehouseLabel, 4),
      size: size || CodeTemplateEngine.slug(unitLabel, 8),
      typeValue: packType || item.type || '',
    };
  }

  _safeParseJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  _extractMetaScalar(value) {
    if (value == null || value === '') return '';
    if (Array.isArray(value)) {
      const parts = value.map((v) => String(v || '').trim()).filter(Boolean);
      return parts.length ? parts.join(', ') : '';
    }
    return String(value).trim();
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
    const staticTemplate = String(prefixStatic || '');
    const hasSeqInTemplate = staticTemplate.includes('{SEQ}') || staticTemplate.includes('{COUNTER}');
    if (!useCounter && !useDate && !hasSeqInTemplate && !staticTemplate.includes('{DATE}')) {
      throw new Error('Rule must include a counter, date segment, or {SEQ}/{DATE} token to stay unique');
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

  _format(rule, ctx, counter) {
    return CodeTemplateEngine.format(rule, ctx, counter);
  }
}

module.exports = new BatchGeneratorService();
