const { v4: uuidv4 } = require('uuid');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

/**
 * SkuGeneratorService — produces unique, human-readable SKUs on demand
 * following Zoho's pattern: one institution-wide default rule, plus optional
 * per-category overrides. Each rule owns its own monotonically increasing
 * counter so two simultaneous creates cannot collide.
 *
 * Rule shape (see create_sku_generator_rules.sql):
 *   scope         'default' | 'category'
 *   scope_value   NULL for default; the category name for overrides
 *   prefix_mode   'static' | 'derived'
 *   prefix_static static text used when mode=static
 *   prefix_source 'category' | 'brand' | 'name' — read from the item ctx
 *   prefix_length #chars to take from the source (uppercase, alnum only)
 *   separator     usually '-' or '_' (may be empty)
 *   use_date      adds a YY / YYMM / YYYYMM / YYYYMMDD segment
 *   use_counter   true => append zero-padded auto-increment
 *   counter_start first value assigned (e.g. 1 -> "0001")
 *   counter_padding zero-pad width (e.g. 4 -> "0001", 6 -> "000001")
 *
 * Schema is provisioned manually via
 *   Backend/src/database/migrations/create_sku_generator_rules.sql
 */
class SkuGeneratorService {
  async listRules(institutionId) {
    const rows = await db.query(
      `SELECT * FROM sku_generator_rules
       WHERE institution_id = ? AND status = 'active'
       ORDER BY is_default DESC, scope_value ASC, name ASC`,
      [institutionId]
    );
    return rows;
  }

  async getRule(institutionId, id) {
    const rows = await db.query(
      'SELECT * FROM sku_generator_rules WHERE institution_id = ? AND id = ?',
      [institutionId, id]
    );
    return rows[0] || null;
  }

  /**
   * Resolve which rule applies for a given generation context.
   *   1. Prefer a 'category' override matching ctx.category (case-insensitive).
   *   2. Fall back to the institution's 'default' rule.
   *   3. Return null if no rule exists yet.
   */
  async resolveRule(institutionId, ctx = {}) {
    if (ctx?.category) {
      const byCat = await db.query(
        `SELECT * FROM sku_generator_rules
         WHERE institution_id = ?
           AND status = 'active'
           AND scope = 'category'
           AND LOWER(scope_value) = LOWER(?)
         LIMIT 1`,
        [institutionId, ctx.category]
      );
      if (byCat.length > 0) return byCat[0];
    }
    const def = await db.query(
      `SELECT * FROM sku_generator_rules
       WHERE institution_id = ? AND status = 'active' AND is_default = 1
       LIMIT 1`,
      [institutionId]
    );
    return def[0] || null;
  }

  /**
   * Upsert a rule. Accepts either { id } to update, or no id to insert.
   * Enforces at most one is_default=1 per institution by flipping others off.
   */
  async upsertRule(institutionId, payload, userId) {
    const {
      id,
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
      isDefault = false
    } = payload || {};

    if (!name || !name.trim()) throw new Error('Rule name is required');
    if (!['default', 'category'].includes(scope)) throw new Error('Invalid scope');
    if (scope === 'category' && !scopeValue) throw new Error('Category name required for category scope');
    if (!['static', 'derived'].includes(prefixMode)) throw new Error('Invalid prefix mode');
    if (prefixMode === 'static' && !prefixStatic?.trim()) throw new Error('Static prefix cannot be empty');
    if (prefixMode === 'derived' && !prefixSource) throw new Error('Derived prefix needs a source field');
    if (useDate && !dateFormat) throw new Error('Date format required when date segment is enabled');
    if (!useCounter && !useDate) {
      // Without a counter or date segment every generate call would return
      // the exact same SKU, so the rule could never produce unique values.
      throw new Error('Rule must include a counter or date segment to stay unique');
    }

    return db.transaction(async (connection) => {
      // Only one default rule per institution.
      if (isDefault) {
        await connection.execute(
          `UPDATE sku_generator_rules SET is_default = 0
           WHERE institution_id = ? AND (id <> ? OR ? IS NULL)`,
          [institutionId, id || '', id || null]
        );
      }

      if (id) {
        await connection.execute(
          `UPDATE sku_generator_rules
           SET name = ?, scope = ?, scope_value = ?,
               prefix_mode = ?, prefix_static = ?, prefix_source = ?, prefix_length = ?,
               separator = ?, use_date = ?, date_format = ?,
               use_counter = ?, counter_start = ?, counter_padding = ?,
               is_default = ?, updated_at = NOW()
           WHERE institution_id = ? AND id = ?`,
          [
            name.trim(), scope, scope === 'category' ? scopeValue : null,
            prefixMode, prefixStatic || null, prefixSource, prefixLength,
            separator, useDate ? 1 : 0, dateFormat,
            useCounter ? 1 : 0, counterStart, counterPadding,
            isDefault ? 1 : 0,
            institutionId, id
          ]
        );
        logger.info('SKU rule updated', { institutionId, id, userId });
        return id;
      }

      const newId = uuidv4();
      await connection.execute(
        `INSERT INTO sku_generator_rules
         (id, institution_id, scope, scope_value, name,
          prefix_mode, prefix_static, prefix_source, prefix_length,
          separator, use_date, date_format,
          use_counter, counter_start, counter_current, counter_padding,
          is_default, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          newId, institutionId, scope, scope === 'category' ? scopeValue : null, name.trim(),
          prefixMode, prefixStatic || null, prefixSource, prefixLength,
          separator, useDate ? 1 : 0, dateFormat,
          useCounter ? 1 : 0, counterStart, Math.max(0, counterStart - 1), counterPadding,
          isDefault ? 1 : 0
        ]
      );
      logger.info('SKU rule created', { institutionId, id: newId, userId });
      return newId;
    });
  }

  async deleteRule(institutionId, id, userId) {
    const result = await db.query(
      `UPDATE sku_generator_rules SET status = 'inactive', updated_at = NOW()
       WHERE institution_id = ? AND id = ?`,
      [institutionId, id]
    );
    if (result.affectedRows === 0) throw new Error('Rule not found');
    logger.info('SKU rule archived', { institutionId, id, userId });
    return true;
  }

  /**
   * Preview a SKU without consuming the counter. Used by the frontend to
   * show the user what the NEXT generate call would produce.
   */
  async previewSku(institutionId, ctx = {}) {
    const rule = await this.resolveRule(institutionId, ctx);
    if (!rule) return { rule: null, preview: '' };
    const nextCounter = (Number(rule.counter_current) || 0) + 1;
    return {
      rule: { id: rule.id, name: rule.name, scope: rule.scope, scope_value: rule.scope_value },
      preview: this._format(rule, ctx, nextCounter)
    };
  }

  /**
   * Atomically allocate the next counter value and format it as a SKU.
   *
   * The counter bump, fresh-value read and duplicate check all run on the
   * same connection inside a transaction so two simultaneous generate calls
   * cannot read the same counter value (MySQL serializes the row-level
   * UPDATE on `sku_generator_rules.id`).
   */
  async generateSku(institutionId, ctx = {}) {
    const rule = await this.resolveRule(institutionId, ctx);
    if (!rule) {
      throw new Error('No SKU rule configured. Create one under Manage SKU Rules first.');
    }

    return db.transaction(async (connection) => {
      const bump = async () => {
        const [updated] = await connection.execute(
          `UPDATE sku_generator_rules
           SET counter_current = GREATEST(counter_current + 1, counter_start),
               updated_at = NOW()
           WHERE institution_id = ? AND id = ?`,
          [institutionId, rule.id]
        );
        if (!updated.affectedRows) throw new Error('Failed to bump SKU counter');
        const [[row]] = await connection.execute(
          'SELECT counter_current AS n FROM sku_generator_rules WHERE id = ?',
          [rule.id]
        );
        return Number(row.n);
      };

      let nextCounter = rule.use_counter ? await bump() : null;
      let finalSku = this._format(rule, ctx, nextCounter);

      // Guard against a pre-existing manual SKU colliding with our output:
      // keep bumping the counter until we find a free slot (bounded so a
      // pathological rule can't loop forever).
      for (let tries = 0; tries < 5; tries++) {
        const [dupe] = await connection.execute(
          'SELECT 1 AS x FROM items WHERE institution_id = ? AND sku = ? LIMIT 1',
          [institutionId, finalSku]
        );
        if (dupe.length === 0) break;
        if (!rule.use_counter) {
          throw new Error(`SKU "${finalSku}" already exists and rule has no counter`);
        }
        nextCounter = await bump();
        finalSku = this._format(rule, ctx, nextCounter);
      }

      return { sku: finalSku, ruleId: rule.id, ruleName: rule.name, counter: nextCounter };
    });
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------

  _slug(raw, length) {
    if (!raw) return '';
    const clean = String(raw)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
    return length ? clean.slice(0, length) : clean;
  }

  _prefix(rule, ctx) {
    if (rule.prefix_mode === 'static') {
      return this._slug(rule.prefix_static, null) || '';
    }
    const source = rule.prefix_source;
    const raw = source === 'category' ? ctx.category
      : source === 'brand' ? ctx.brand
      : source === 'name' ? ctx.name
      : '';
    return this._slug(raw, rule.prefix_length || 3);
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
    const parts = [
      this._prefix(rule, ctx),
      this._datePart(rule),
      this._counterPart(rule, counter)
    ].filter(Boolean);
    return parts.join(rule.separator || '-');
  }
}

module.exports = new SkuGeneratorService();
