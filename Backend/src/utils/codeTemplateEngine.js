/**
 * Shared SKU / batch number template engine.
 * Supports tokens: {TOKEN}, {TOKEN|length|mode}
 * Modes: abbr (initials), slice (leading chars)
 */
class CodeTemplateEngine {
  static DATE_FORMATS = new Set(['YY', 'YYMM', 'YYYYMM', 'YYYYMMDD']);

  static slug(raw, length) {
    if (!raw) return '';
    const clean = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
    return length ? clean.slice(0, length) : clean;
  }

  static abbr(raw, length = 10) {
    if (!raw) return '';
    const words = String(raw).trim().split(/[^A-Za-z0-9]+/g).filter(Boolean);
    if (!words.length) return '';
    const cap = Math.max(1, Number(length) || 10);
    return words.map((w) => w[0].toUpperCase()).join('').slice(0, cap);
  }

  static extract(value, len = 10, mode = 'abbr') {
    const width = Math.max(1, Number(len) || 10);
    const m = String(mode || 'abbr').toLowerCase();
    if (m === 'slice' || m === 'chars') return CodeTemplateEngine.slug(value, width);
    return CodeTemplateEngine.abbr(value, width);
  }

  static datePart(rule) {
    if (!rule?.use_date) return '';
    const d = new Date();
    const yyyy = d.getFullYear();
    const yy = String(yyyy).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    switch (String(rule.date_format || '').toUpperCase()) {
      case 'YY': return yy;
      case 'YYMM': return `${yy}${mm}`;
      case 'YYYYMM': return `${yyyy}${mm}`;
      case 'YYYYMMDD': return `${yyyy}${mm}${dd}`;
      default: return '';
    }
  }

  static counterPart(rule, counter) {
    if (!rule?.use_counter || counter == null) return '';
    const width = Math.max(1, Number(rule.counter_padding) || 4);
    return String(counter).padStart(width, '0');
  }

  static templatePrefix(rule, ctx, counter) {
    const rawTemplate = String(rule.prefix_static || '');
    const datePart = CodeTemplateEngine.datePart(rule);
    const counterPart = CodeTemplateEngine.counterPart(rule, counter);
    const short = (v, n = 3) => CodeTemplateEngine.slug(v, n);
    const full = (v) => CodeTemplateEngine.slug(v, null);

    return rawTemplate.replace(/\{([^}]+)\}/g, (_, tokenExpr) => {
      const [rawToken, rawLen, rawMode] = String(tokenExpr || '').split('|').map((p) => String(p || '').trim());
      const t = String(rawToken || '').toUpperCase();
      const customLen = rawLen ? Number(rawLen) : null;
      const customMode = rawMode || null;
      const pick = (value, defaultLen = 10, defaultMode = 'abbr') => (
        customLen || customMode
          ? CodeTemplateEngine.extract(value, customLen || defaultLen, customMode || defaultMode)
          : full(value)
      );

      switch (t) {
        case 'SKU': return full(ctx.sku || ctx.skuCode);
        case 'BRAND':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.brand, customLen || 10, customMode || 'abbr')
            : full(ctx.brandCode || short(ctx.brand));
        case 'ITEM':
        case 'NAME':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.item || ctx.name, customLen || 10, customMode || 'abbr')
            : full(ctx.itemCode || short(ctx.item || ctx.name, 4));
        case 'VARIANT':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.variant, customLen || 10, customMode || 'abbr')
            : full(ctx.variantCode || short(ctx.variant));
        case 'COLOR':
        case 'COLOUR':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.color, customLen || 10, customMode || 'abbr')
            : full(ctx.colorCode || short(ctx.color));
        case 'SIZE':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.size || ctx.unit, customLen || 10, customMode || 'slice')
            : full(ctx.size || ctx.unitCode || short(ctx.unit));
        case 'TYPE':
        case 'PACKTYPE':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.typeValue || ctx.type || ctx.packType, customLen || 10, customMode || 'abbr')
            : full(ctx.typeCode || short(ctx.typeValue || ctx.type));
        case 'CATEGORY':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.category, customLen || 10, customMode || 'abbr')
            : full(ctx.categoryCode || short(ctx.category));
        case 'MANUFACTURER':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.manufacturer, customLen || 10, customMode || 'abbr')
            : full(ctx.manufacturerCode || short(ctx.manufacturer));
        case 'UNIT':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.unit, customLen || 10, customMode || 'slice')
            : full(ctx.unitCode || short(ctx.unit));
        case 'WAREHOUSE':
          return customLen || customMode
            ? CodeTemplateEngine.extract(ctx.warehouse, customLen || 10, customMode || 'slice')
            : full(ctx.warehouseCode || short(ctx.warehouse));
        case 'CONTEXT':
          return full(ctx.context || '');
        case 'HSN':
          return full(ctx.hsnCode || ctx.hsn);
        case 'MPN':
          return full(ctx.mpn);
        case 'BARCODE':
          return full(ctx.barcode);
        case 'DATE':
          return datePart;
        case 'SEQ':
        case 'COUNTER':
          return counterPart;
        default:
          return full(ctx[t.toLowerCase()] || ctx[rawToken] || '');
      }
    }).replace(/-{2,}/g, '-').replace(/(^-|-$)/g, '');
  }

  static prefix(rule, ctx, counter) {
    if (rule.prefix_mode === 'static') {
      if (String(rule.prefix_static || '').includes('{')) {
        return CodeTemplateEngine.templatePrefix(rule, ctx, counter);
      }
      return CodeTemplateEngine.slug(rule.prefix_static, null) || '';
    }
    const source = rule.prefix_source;
    const raw = source === 'category' ? ctx.category
      : source === 'brand' ? ctx.brand
      : source === 'sku' ? ctx.sku
      : source === 'name' ? ctx.name
      : '';
    if (source === 'sku') return CodeTemplateEngine.slug(raw, null);
    return CodeTemplateEngine.abbr(raw, rule.prefix_length || 3);
  }

  static format(rule, ctx, counter) {
    if (rule.prefix_mode === 'static' && String(rule.prefix_static || '').includes('{')) {
      return CodeTemplateEngine.prefix(rule, ctx, counter);
    }
    const parts = [
      CodeTemplateEngine.prefix(rule, ctx, counter),
      CodeTemplateEngine.datePart(rule),
      CodeTemplateEngine.counterPart(rule, counter),
    ].filter(Boolean);
    return parts.join(rule.separator || '-');
  }
}

module.exports = CodeTemplateEngine;
