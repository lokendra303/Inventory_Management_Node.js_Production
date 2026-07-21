export const CODE_TEMPLATE_TOKENS = [
  '{BRAND}', '{ITEM}', '{VARIANT}', '{COLOR}', '{SIZE}', '{TYPE}', '{CATEGORY}',
  '{MANUFACTURER}', '{UNIT}', '{WAREHOUSE}', '{HSN}', '{MPN}', '{BARCODE}',
  '{SKU}', '{CONTEXT}', '{DATE}', '{SEQ}',
];

export const DERIVED_TOKEN_BY_SOURCE = {
  category: 'CATEGORY',
  brand: 'BRAND',
  name: 'ITEM',
  variant: 'VARIANT',
  color: 'COLOR',
  size: 'SIZE',
  type: 'TYPE',
  manufacturer: 'MANUFACTURER',
  unit: 'UNIT',
  warehouse: 'WAREHOUSE',
  sku: 'SKU',
  hsn: 'HSN',
  mpn: 'MPN',
  barcode: 'BARCODE',
};

export const SOURCE_BY_DERIVED_TOKEN = Object.fromEntries(
  Object.entries(DERIVED_TOKEN_BY_SOURCE).map(([source, token]) => [token, source])
);

export const DERIVED_SOURCE_LABELS = {
  category: 'Category',
  brand: 'Brand',
  name: 'Item name',
  variant: 'Variant / packing',
  color: 'Colour',
  size: 'Size',
  type: 'Pack type',
  manufacturer: 'Manufacturer',
  unit: 'Unit',
  warehouse: 'Warehouse',
  sku: 'SKU',
  hsn: 'HSN',
  mpn: 'MPN',
  barcode: 'Barcode',
};

export const DERIVED_SOURCE_OPTIONS = Object.keys(DERIVED_TOKEN_BY_SOURCE).map((key) => ({
  value: key,
  label: DERIVED_SOURCE_LABELS[key] || key,
}));

export const DEFAULT_DERIVED_CFG = { len: 10, mode: 'abbr' };

export const SEPARATOR_CUSTOM = '__custom__';
export const PREDEFINED_SEPARATORS = new Set(['-', '_', '']);

export const resolveSeparatorFromForm = (values = {}) => {
  if (values.separator === SEPARATOR_CUSTOM) {
    return String(values.separatorCustom ?? '').slice(0, 3);
  }
  return values.separator === '' ? '' : (values.separator || '-');
};

export const mapSeparatorToForm = (separator) => {
  const stored = separator ?? '-';
  if (PREDEFINED_SEPARATORS.has(stored)) {
    return { separator: stored, separatorCustom: '' };
  }
  return { separator: SEPARATOR_CUSTOM, separatorCustom: stored };
};

export const buildDefaultDerivedConfig = () => Object.fromEntries(
  Object.keys(DERIVED_TOKEN_BY_SOURCE).map((src) => [src, { ...DEFAULT_DERIVED_CFG }])
);

export const preserveSelectionOrder = (previous = [], current = []) => {
  const prev = Array.isArray(previous) ? previous : [];
  const cur = Array.isArray(current) ? current : [];
  const inBoth = prev.filter((x) => cur.includes(x));
  const appended = cur.filter((x) => !inBoth.includes(x));
  return [...inBoth, ...appended];
};

export const parseDerivedTemplateConfig = (prefixStatic = '') => {
  const matches = String(prefixStatic || '').match(/\{[^}]+\}/g) || [];
  if (!matches.length) return null;
  const sources = [];
  const config = {};
  for (const tokenWrap of matches) {
    const inside = tokenWrap.slice(1, -1);
    const [tokenRaw, lenRaw, modeRaw] = inside.split('|').map((p) => String(p || '').trim());
    const token = String(tokenRaw || '').toUpperCase();
    const src = SOURCE_BY_DERIVED_TOKEN[token];
    if (!src) return null;
    sources.push(src);
    config[src] = {
      len: Math.max(1, Number(lenRaw) || 10),
      mode: ['abbr', 'slice'].includes(String(modeRaw || '').toLowerCase()) ? String(modeRaw).toLowerCase() : 'abbr',
    };
  }
  return { sources, config };
};

export const buildPayloadFromFormValues = (values = {}) => {
  const sourceList = Array.isArray(values.prefixSources) ? values.prefixSources.filter(Boolean) : [];
  const cfg = values.prefixSourceConfig || {};
  const payload = {
    ...values,
    isDefault: values.scope === 'default' ? !!values.isDefault : false,
    counterStart: Math.max(1, Number(values.counterStart || 1)),
    separator: resolveSeparatorFromForm(values),
  };

  if (values.prefixMode === 'derived') {
    payload.prefixMode = 'static';
    payload.prefixSource = null;
    const sep = resolveSeparatorFromForm(values);
    payload.prefixStatic = sourceList
      .map((s) => {
        const token = DERIVED_TOKEN_BY_SOURCE[s];
        if (!token) return null;
        const c = cfg[s] || DEFAULT_DERIVED_CFG;
        const len = Math.max(1, Number(c?.len) || 10);
        const mode = String(c?.mode || 'abbr').toLowerCase() === 'slice' ? 'slice' : 'abbr';
        return `{${token}|${len}|${mode}}`;
      })
      .filter(Boolean)
      .join(sep === '' ? '' : sep);
  } else {
    payload.prefixSource = null;
  }

  delete payload.prefixSources;
  delete payload.prefixSourceConfig;
  delete payload.separatorCustom;
  if (payload.scope !== 'category') payload.scopeValue = null;
  return payload;
};

export const mapRuleToFormValues = (rule = {}) => {
  const parsedDerived = rule.prefix_mode === 'static'
    ? parseDerivedTemplateConfig(rule.prefix_static)
    : null;
  const effectivePrefixMode = parsedDerived ? 'derived' : rule.prefix_mode;
  const effectiveSources = parsedDerived
    ? parsedDerived.sources
    : (rule.prefix_source ? [rule.prefix_source] : []);

  return {
    name: rule.name,
    scope: rule.scope,
    scopeValue: rule.scope_value,
    context: rule.context,
    prefixMode: effectivePrefixMode,
    prefixStatic: rule.prefix_static,
    prefixSources: effectiveSources,
    prefixSourceConfig: { ...buildDefaultDerivedConfig(), ...(parsedDerived?.config || {}) },
    prefixLength: rule.prefix_length,
    ...mapSeparatorToForm(rule.separator),
    useDate: !!rule.use_date,
    dateFormat: rule.date_format,
    useCounter: !!rule.use_counter,
    counterStart: rule.counter_start,
    counterPadding: rule.counter_padding,
    isDefault: !!rule.is_default,
  };
};

export const SAMPLE_SKU_PREVIEW_CONTEXT = {
  category: 'Cosmetics',
  brand: 'Acme Labs',
  manufacturer: 'Acme Mfg',
  name: 'Brightening Cleanser',
  item: 'Brightening Cleanser',
  variant: '100ML',
  color: 'Rose',
  size: '100ML',
  type: 'simple',
  typeValue: 'Bottle',
  unit: 'pcs',
  warehouse: 'WH01',
  hsnCode: '3304',
  mpn: 'MPN-001',
  barcode: '8901234567890',
  brandCode: 'ALB',
  itemCode: 'BCLE',
  variantCode: '100M',
  colorCode: 'ROS',
  categoryCode: 'COS',
  typeCode: 'BOT',
  unitCode: 'PCS',
  warehouseCode: 'WH01',
};

export const SAMPLE_BATCH_PREVIEW_CONTEXT = {
  ...SAMPLE_SKU_PREVIEW_CONTEXT,
  context: 'kit_assembly',
  sku: 'KIT-100ML-001',
  skuCode: 'KIT100ML001',
  type: 'composite',
};

export const ADVANCED_TOKEN_HELP = [
  'Click a token chip to insert it into the template.',
  'Advanced: {TOKEN|length|mode} — mode is abbr (initials) or slice (leading chars).',
  'Example: {BRAND|3|abbr}-{ITEM|4|slice}-{DATE}-{SEQ}',
  'Derived mode builds the same template from field pickers automatically.',
];

const slug = (raw, length) => {
  if (!raw) return '';
  const clean = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  return length ? clean.slice(0, length) : clean;
};

const abbr = (raw, length = 10) => {
  if (!raw) return '';
  const words = String(raw).trim().split(/[^A-Za-z0-9]+/g).filter(Boolean);
  if (!words.length) return '';
  const cap = Math.max(1, Number(length) || 10);
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, cap);
};

const extract = (value, len = 10, mode = 'abbr') => {
  const width = Math.max(1, Number(len) || 10);
  const m = String(mode || 'abbr').toLowerCase();
  if (m === 'slice' || m === 'chars') return slug(value, width);
  return abbr(value, width);
};

const datePart = (rule) => {
  if (!rule?.useDate && !rule?.use_date) return '';
  const d = new Date();
  const yyyy = d.getFullYear();
  const yy = String(yyyy).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const fmt = String(rule.dateFormat || rule.date_format || '').toUpperCase();
  switch (fmt) {
    case 'YY': return yy;
    case 'YYMM': return `${yy}${mm}`;
    case 'YYYYMM': return `${yyyy}${mm}`;
    case 'YYYYMMDD': return `${yyyy}${mm}${dd}`;
    default: return '';
  }
};

const counterPart = (rule, counter) => {
  const useCounter = rule.useCounter ?? rule.use_counter;
  if (!useCounter || counter == null) return '';
  const width = Math.max(1, Number(rule.counterPadding ?? rule.counter_padding) || 4);
  return String(counter).padStart(width, '0');
};

const templatePrefix = (rule, ctx, counter) => {
  const rawTemplate = String(rule.prefixStatic || rule.prefix_static || '');
  const dp = datePart(rule);
  const cp = counterPart(rule, counter);
  const short = (v, n = 3) => slug(v, n);
  const full = (v) => slug(v, null);

  return rawTemplate.replace(/\{([^}]+)\}/g, (_, tokenExpr) => {
    const [rawToken, rawLen, rawMode] = String(tokenExpr || '').split('|').map((p) => String(p || '').trim());
    const t = String(rawToken || '').toUpperCase();
    const customLen = rawLen ? Number(rawLen) : null;
    const customMode = rawMode || null;
    const pick = (value, defaultLen = 10, defaultMode = 'abbr') => (
      customLen || customMode
        ? extract(value, customLen || defaultLen, customMode || defaultMode)
        : full(value)
    );

    switch (t) {
      case 'SKU': return full(ctx.sku || ctx.skuCode);
      case 'BRAND': return pick(ctx.brand, 10, 'abbr') || full(ctx.brandCode || short(ctx.brand));
      case 'ITEM':
      case 'NAME':
        return pick(ctx.item || ctx.name, 10, 'abbr') || full(ctx.itemCode || short(ctx.item || ctx.name, 4));
      case 'VARIANT': return pick(ctx.variant, 10, 'abbr') || full(ctx.variantCode || short(ctx.variant));
      case 'COLOR':
      case 'COLOUR': return pick(ctx.color, 10, 'abbr') || full(ctx.colorCode || short(ctx.color));
      case 'SIZE': return pick(ctx.size || ctx.unit, 10, 'slice') || full(ctx.size || ctx.unitCode || short(ctx.unit));
      case 'TYPE':
      case 'PACKTYPE':
        return pick(ctx.typeValue || ctx.type || ctx.packType, 10, 'abbr') || full(ctx.typeCode || short(ctx.typeValue || ctx.type));
      case 'CATEGORY': return pick(ctx.category, 10, 'abbr') || full(ctx.categoryCode || short(ctx.category));
      case 'MANUFACTURER': return pick(ctx.manufacturer, 10, 'abbr') || full(ctx.manufacturerCode || short(ctx.manufacturer));
      case 'UNIT': return pick(ctx.unit, 10, 'slice') || full(ctx.unitCode || short(ctx.unit));
      case 'WAREHOUSE': return pick(ctx.warehouse, 10, 'slice') || full(ctx.warehouseCode || short(ctx.warehouse));
      case 'CONTEXT': return full(ctx.context || '');
      case 'HSN': return full(ctx.hsnCode || ctx.hsn);
      case 'MPN': return full(ctx.mpn);
      case 'BARCODE': return full(ctx.barcode);
      case 'DATE': return dp;
      case 'SEQ':
      case 'COUNTER': return cp;
      default:
        return full(ctx[t.toLowerCase()] || ctx[rawToken] || '');
    }
  }).replace(/-{2,}/g, '-').replace(/(^-|-$)/g, '');
};

/** Client-side preview (matches backend CodeTemplateEngine). */
export const previewCodeFromFormValues = (formValues = {}, sampleCtx = {}, counter = 1) => {
  const rule = {
    prefixMode: formValues.prefixMode === 'derived' ? 'static' : (formValues.prefixMode || 'static'),
    prefixStatic: formValues.prefixStatic,
    prefixSource: formValues.prefixSource,
    prefixLength: formValues.prefixLength,
    separator: resolveSeparatorFromForm(formValues),
    useDate: formValues.useDate,
    dateFormat: formValues.dateFormat,
    useCounter: formValues.useCounter,
    counterPadding: formValues.counterPadding,
  };

  if (formValues.prefixMode === 'derived') {
    const built = buildPayloadFromFormValues(formValues);
    rule.prefixStatic = built.prefixStatic;
    rule.separator = built.separator;
  }

  if (rule.prefixMode === 'static' && String(rule.prefixStatic || '').includes('{')) {
    return templatePrefix(rule, sampleCtx, counter);
  }

  const parts = [
    rule.prefixMode === 'static' ? slug(rule.prefixStatic, null) : abbr(sampleCtx[rule.prefixSource] || sampleCtx.category, rule.prefixLength || 3),
    datePart(rule),
    counterPart(rule, counter),
  ].filter(Boolean);
  const sep = rule.separator === '' ? '' : (rule.separator || '-');
  return parts.join(sep);
};
