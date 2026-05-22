import apiService from '../../services/apiService';
import {
  CSV_IMPORT_SKU_FROM_FILE,
  CSV_IMPORT_SKU_AUTO_RULE,
  CSV_IMPORT_DEFAULTABLE_CORE_IDS,
} from './importConstants';

export { CSV_IMPORT_SKU_FROM_FILE, CSV_IMPORT_SKU_AUTO_RULE, CSV_IMPORT_DEFAULTABLE_CORE_IDS };

export function isSkuRequiredForImport(skuSource = CSV_IMPORT_SKU_FROM_FILE) {
  return skuSource !== CSV_IMPORT_SKU_AUTO_RULE;
}

export function isImportRowReady(row, mapping, skuSource = CSV_IMPORT_SKU_FROM_FILE, importDefaults = {}) {
  const name = pickImportValue(row, mapping, importDefaults, 'name');
  if (!name) return false;
  if (!isSkuRequiredForImport(skuSource)) return true;
  const sku = pickImportValue(row, mapping, importDefaults, 'sku');
  if (!mapping?.sku && !importDefaults?.sku) return !!sku;
  return !!sku;
}

export function findMasterOptionByName(options, name, keys = ['name']) {
  const q = String(name ?? '').trim().toLowerCase();
  if (!q) return null;
  return (
    options.find((o) =>
      keys.some((k) => String(o[k] ?? '').trim().toLowerCase() === q)
    ) || null
  );
}

export function parseFieldConfigOptions(options) {
  if (Array.isArray(options)) return options.map((o) => String(o));
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed.map((o) => String(o)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseCreatedMasterRecord(response, fallbackName) {
  if (!response || typeof response !== 'object') return null;
  if (response.id) {
    return { id: response.id, name: response.name || fallbackName };
  }
  const d = response.data;
  if (d?.groupId) return { id: d.groupId, name: fallbackName };
  if (d?.categoryId) return { id: d.categoryId, name: fallbackName };
  if (d?.typeId) return { id: d.typeId, name: fallbackName };
  if (d?.id) return { id: d.id, name: d.name || fallbackName };
  return null;
}

export async function fetchMasterList(getPath) {
  const res = await apiService.get(getPath);
  return Array.isArray(res) ? res : (res?.data || []);
}

function resolveUnitIdFromList(raw, unitOptions) {
  const s = String(raw ?? '').trim();
  if (!s) {
    const pcs = findMasterOptionByName(unitOptions, 'pcs', ['name', 'symbol', 'id']);
    return pcs?.id || unitOptions[0]?.id || null;
  }
  const byId = unitOptions.find((u) => u.id === s);
  if (byId) return byId.id;
  const hit = findMasterOptionByName(unitOptions, s, ['name', 'symbol', 'id']);
  return hit?.id || null;
}

/** Parse numeric import cell; invalid non-empty text is flagged (not silently turned into 0). */
export function parseImportNumeric(raw, { emptyAsZero = true } = {}) {
  const s = String(raw ?? '').trim();
  if (s === '') {
    return { value: emptyAsZero ? 0 : undefined, invalid: false, empty: true };
  }
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) {
    return { value: emptyAsZero ? 0 : undefined, invalid: true, empty: false };
  }
  return { value: n, invalid: false, empty: false };
}

export function buildDuplicateSkuKeysInFile(rows, mapping) {
  const counts = new Map();
  for (const row of rows || []) {
    const col = mapping?.sku;
    if (!col) continue;
    const v = row[col];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    const key = String(v).trim().toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Gate before opening add-item form from an import row. */
export function validateImportRowBeforeOpen({
  row,
  mapping,
  fieldConfigs = [],
  defaultWarehouseId,
  duplicateSkuKeys = new Set(),
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  hasSkuRules = true,
  importDefaults = {},
}) {
  const getCell = createImportRowGetCell(row);
  const pick = (fieldKey) => pickImportValue(row, mapping, importDefaults, fieldKey);
  const errors = [];
  const warnings = [];
  const skuFromFile = isSkuRequiredForImport(skuSource);

  const sku = skuFromFile ? pick('sku') : pick('sku');
  const name = pick('name');

  if (!mapping?.name && !importDefaults?.name) {
    errors.push('Name column is not mapped (map a column or set a default name for all rows).');
  } else if (!name) {
    errors.push('This row has no Name value (file cell empty and no default name).');
  }

  if (skuFromFile) {
    if (!mapping?.sku && !importDefaults?.sku) {
      errors.push('SKU column is not mapped (map a column or set a default SKU for all rows).');
    } else if (!sku) {
      errors.push('This row has no SKU (file cell empty and no default SKU).');
    }
  } else {
    if (!hasSkuRules) {
      errors.push('No SKU rules found. Create an SKU rule or switch to “SKU from file column”.');
    }
    const fileSku = mapping?.sku ? getCell(mapping.sku) : '';
    if (!fileSku) {
      warnings.push('SKU will be auto-generated from your SKU rule when you use Add in form.');
    }
  }

  const skuForDup = pick('sku');
  if (skuForDup && duplicateSkuKeys.has(skuForDup.toLowerCase())) {
    warnings.push(`SKU "${skuForDup}" appears more than once in this file. Only the first save will succeed unless you change SKUs.`);
  }

  for (const c of fieldConfigs) {
    const fn = c.field_name || c.fieldName;
    if (!fn) continue;
    const required = Boolean(c.is_required || c.isRequired);
    if (!required) continue;
    const label = c.field_label || c.fieldLabel || fn;
    const col = mapping[`cf:${fn}`];
    const cfKey = `cf:${fn}`;
    const effective = pick(cfKey);
    if (!mapping[cfKey] && !importDefaults[cfKey]) {
      errors.push(`Required custom field "${label}" is not mapped and has no import default.`);
      continue;
    }
    if (!effective) {
      errors.push(`Required custom field "${label}" is empty on this row (map, or set an import default).`);
    }
  }

  const stockCell = pick('openingStock');
  const stockParsed = parseImportNumeric(stockCell);
  if (stockParsed.invalid) {
    warnings.push(`Opening stock "${stockCell}" is not a valid number; it will be treated as 0.`);
  }
  if ((stockParsed.value || 0) > 0 && !defaultWarehouseId) {
    errors.push('Select a default warehouse in the import dialog (required when this row has opening stock).');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function createImportRowGetCell(row) {
  return (colKey) => {
    if (!colKey) return '';
    const v = row[colKey];
    if (v === undefined || v === null) return '';
    return String(v).trim();
  };
}

/**
 * File column wins when mapped and non-empty; otherwise use import-wide default.
 * @param {string} fieldKey - mapping key (e.g. "category", "cf:color")
 */
export function pickImportValue(row, mapping = {}, importDefaults = {}, fieldKey) {
  const getCell = createImportRowGetCell(row);
  const col = mapping?.[fieldKey];
  if (col) {
    const fromFile = getCell(col);
    if (fromFile !== '') return fromFile;
  }
  const d = importDefaults?.[fieldKey];
  if (d === undefined || d === null) return '';
  return String(d).trim();
}

export function countImportDefaultsSet(importDefaults = {}) {
  return Object.values(importDefaults).filter((v) => v !== undefined && v !== null && String(v).trim() !== '').length;
}

function pushMismatchColumn(mismatchColumns, col) {
  if (col && !mismatchColumns.includes(col)) mismatchColumns.push(col);
}

/** Sync row assessment for import preview highlighting (no API calls). */
export function assessImportRowIssues({
  row,
  mapping = {},
  fieldConfigs = [],
  defaultWarehouseId,
  duplicateSkuKeys = new Set(),
  existingSkuKeys = new Set(),
  brandOptions = [],
  manufacturerOptions = [],
  unitOptions = [],
  canManageItems = false,
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  hasSkuRules = true,
  importDefaults = {},
}) {
  const getCell = createImportRowGetCell(row);
  const pick = (fieldKey) => pickImportValue(row, mapping, importDefaults, fieldKey);
  const mismatchColumns = [];
  const skuFromFile = isSkuRequiredForImport(skuSource);

  const base = validateImportRowBeforeOpen({
    row,
    mapping,
    fieldConfigs,
    defaultWarehouseId,
    duplicateSkuKeys,
    skuSource,
    hasSkuRules,
    importDefaults,
  });

  const errors = [...base.errors];
  const warnings = [...base.warnings];

  const sku = pick('sku');
  const name = pick('name');

  if (skuFromFile) {
    if (!sku && (mapping?.sku || importDefaults?.sku)) {
      if (mapping?.sku) pushMismatchColumn(mismatchColumns, mapping.sku);
    }
  } else if (mapping?.sku && !sku) {
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  if (!mapping?.name && !importDefaults?.name) {
    errors.push('Name column is not mapped (map a column or set a default name).');
  } else if (!name) {
    if (mapping?.name) pushMismatchColumn(mismatchColumns, mapping.name);
  }

  if (sku && existingSkuKeys.has(sku.toLowerCase())) {
    errors.push(`SKU "${sku}" already exists in your item catalog.`);
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  if (sku && duplicateSkuKeys.has(sku.toLowerCase())) {
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  const stockCell = pick('openingStock');
  const stockParsed = parseImportNumeric(stockCell);
  if (stockParsed.invalid) {
    if (mapping?.openingStock) pushMismatchColumn(mismatchColumns, mapping.openingStock);
  }
  if ((stockParsed.value || 0) > 0 && !defaultWarehouseId) {
    if (mapping?.openingStock) pushMismatchColumn(mismatchColumns, mapping.openingStock);
  }

  const openingValueCell = pick('openingValue');
  if (parseImportNumeric(openingValueCell).invalid) {
    warnings.push(`Opening value "${openingValueCell}" is not a valid number.`);
    if (mapping?.openingValue) pushMismatchColumn(mismatchColumns, mapping.openingValue);
  }

  for (const numericKey of ['costPrice', 'sellingPrice', 'mrp', 'taxRate', 'minStockLevel', 'maxStockLevel', 'weight']) {
    const raw = pick(numericKey);
    if (!raw) continue;
    if (parseImportNumeric(raw, { emptyAsZero: false }).invalid) {
      warnings.push(`"${numericKey}" value "${raw}" is not a valid number.`);
      if (mapping[numericKey]) pushMismatchColumn(mismatchColumns, mapping[numericKey]);
    }
  }

  const brandStr = pick('brand');
  if (brandStr && !findMasterOptionByName(brandOptions, brandStr)) {
    const msg = canManageItems
      ? `Brand "${brandStr}" is not in the list (will be created when you use Add in form).`
      : `Brand "${brandStr}" does not match any brand in the system.`;
    if (canManageItems) warnings.push(msg);
    else errors.push(msg);
    if (mapping?.brand) pushMismatchColumn(mismatchColumns, mapping.brand);
  }

  const mfrStr = pick('manufacturer');
  if (mfrStr && !findMasterOptionByName(manufacturerOptions, mfrStr)) {
    const msg = canManageItems
      ? `Manufacturer "${mfrStr}" is not in the list (will be created on Add in form).`
      : `Manufacturer "${mfrStr}" does not match any manufacturer in the system.`;
    if (canManageItems) warnings.push(msg);
    else errors.push(msg);
    if (mapping?.manufacturer) pushMismatchColumn(mismatchColumns, mapping.manufacturer);
  }

  const unitStr = pick('unit');
  if (unitStr) {
    const unitOk = unitOptions.some((u) => u.id === unitStr)
      || !!findMasterOptionByName(unitOptions, unitStr, ['name', 'symbol', 'id']);
    if (!unitOk) {
      const msg = canManageItems
        ? `Unit "${unitStr}" is not in the list (will be created on Add in form).`
        : `Unit "${unitStr}" does not match any unit in the system.`;
      if (canManageItems) warnings.push(msg);
      else errors.push(msg);
      if (mapping?.unit) pushMismatchColumn(mismatchColumns, mapping.unit);
    }
  }

  for (const c of fieldConfigs) {
    const fn = c.field_name || c.fieldName;
    if (!fn) continue;
    const label = c.field_label || c.fieldLabel || fn;
    const cfKey = `cf:${fn}`;
    const col = mapping[cfKey];
    const required = Boolean(c.is_required || c.isRequired);

    if (required && !col && !importDefaults[cfKey]) {
      continue;
    }
    if (!col && !importDefaults[cfKey]) continue;

    const effective = pick(cfKey);
    if (required && !effective) {
      pushMismatchColumn(mismatchColumns, col || cfKey);
      continue;
    }
    if (!effective) continue;

    const fieldType = String(c.field_type || c.fieldType || 'text').toLowerCase();
    const value = coerceImportedCustomValue(effective, fieldType);
    if (value === undefined) {
      errors.push(`Custom field "${label}": invalid value "${String(effective).trim()}".`);
      pushMismatchColumn(mismatchColumns, col);
      continue;
    }

    if (fieldType === 'select') {
      const options = parseFieldConfigOptions(c.options);
      if (options.length > 0) {
        const match = options.find((o) => o === value)
          || options.find((o) => o.toLowerCase() === String(value).toLowerCase());
        if (!match) {
          if (canManageItems) {
            warnings.push(`Custom field "${label}": "${value}" will be added to allowed options.`);
          } else {
            errors.push(`Custom field "${label}": "${value}" must be one of: ${options.join(', ')}.`);
          }
          pushMismatchColumn(mismatchColumns, col);
        }
      }
    }
  }

  const level = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';
  return {
    level,
    ok: errors.length === 0,
    errors,
    warnings,
    mismatchColumns,
    summary: errors[0] || warnings[0] || null,
  };
}

export const IMPORT_PREVIEW_ROW_STYLE = {
  ok: {},
  warning: { background: '#fffbe6' },
  error: { background: '#fff1f0' },
  added: { background: '#f6ffed' },
};

export const IMPORT_PREVIEW_CELL_MISMATCH_STYLE = {
  background: '#ffccc7',
  boxShadow: 'inset 0 0 0 1px #ff7875',
};

export async function checkSkuAvailableForImport(sku) {
  const text = String(sku || '').trim();
  if (!text) return { available: false, error: 'SKU is empty' };
  try {
    const res = await apiService.get('/items/check-sku', { params: { sku: text } });
    return { available: !!res?.data?.available, error: null };
  } catch (e) {
    return { available: false, error: e?.response?.data?.error || 'Could not verify SKU' };
  }
}

/** Create master-data dropdown entry; refetch list on duplicate race. */
export async function ensureImportDropdownOption({
  value,
  options,
  postPath,
  getPath,
  buildBody,
  matchKeys = ['name'],
}) {
  const text = String(value ?? '').trim();
  if (!text) return { id: undefined, options, created: false };
  const found = findMasterOptionByName(options, text, matchKeys);
  if (found?.id) return { id: found.id, options, created: false };
  try {
    const res = await apiService.post(postPath, buildBody(text));
    const row = parseCreatedMasterRecord(res, text);
    if (!row?.id) return { id: undefined, options, created: false };
    const merged = [...options, { ...row, name: row.name || text }];
    return { id: row.id, options: merged, created: true, createdLabel: text };
  } catch (err) {
    const errMsg = String(err?.response?.data?.error || err?.message || '').toLowerCase();
    if (getPath && (errMsg.includes('already exists') || errMsg.includes('duplicate'))) {
      try {
        const fresh = await fetchMasterList(getPath);
        const again = findMasterOptionByName(fresh, text, matchKeys);
        if (again?.id) return { id: again.id, options: fresh, created: false };
      } catch {
        /* fall through */
      }
    }
    console.warn(`Import: could not create option "${text}" at ${postPath}`, err);
    return { id: undefined, options, created: false, error: err };
  }
}

export async function ensureUnitForImport(raw, unitOptions) {
  let options = unitOptions || [];
  const s = String(raw ?? '').trim();

  if (!s) {
    let id = resolveUnitIdFromList('', options);
    if (id) return { id, options, created: false };
    const created = await ensureImportDropdownOption({
      value: 'pcs',
      options,
      postPath: '/units',
      getPath: '/units',
      buildBody: (name) => ({ name, symbol: name }),
      matchKeys: ['name', 'symbol', 'id'],
    });
    return { id: created.id, options: created.options, created: created.created };
  }

  let id = resolveUnitIdFromList(s, options);
  if (id) return { id, options, created: false };

  const created = await ensureImportDropdownOption({
    value: s,
    options,
    postPath: '/units',
    getPath: '/units',
    buildBody: (name) => ({ name, symbol: name }),
    matchKeys: ['name', 'symbol', 'id'],
  });
  if (created.id) return created;

  options = created.options?.length ? created.options : await fetchMasterList('/units');
  id = resolveUnitIdFromList(s, options);
  return { id, options, created: false };
}

export function coerceImportedCustomValue(raw, fieldType) {
  const str = String(raw ?? '').trim();
  if (str === '') return undefined;
  const t = String(fieldType || 'text').toLowerCase();
  if (t === 'number' || t === 'decimal') {
    const n = Number(str.replace(/,/g, ''));
    if (!Number.isFinite(n)) return undefined;
    return t === 'number' ? Math.round(n) : n;
  }
  return str;
}

/** Resolve custom fields for import: case-insensitive select match; extend options when allowed. */
export async function resolveImportCustomFields({
  row,
  mapping,
  fieldConfigs = [],
  itemType,
  getCell,
  canManageItems,
  importDefaults = {},
}) {
  const customFields = {};
  const created = [];
  const errors = [];
  const preview = [];

  for (const c of fieldConfigs) {
    const fn = c.field_name || c.fieldName;
    if (!fn) continue;
    const label = c.field_label || c.fieldLabel || fn;
    const cfKey = `cf:${fn}`;
    const col = mapping[cfKey];
    let raw = col ? row[col] : undefined;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      const fromDefault = importDefaults[cfKey];
      if (fromDefault === undefined || fromDefault === null || String(fromDefault).trim() === '') continue;
      raw = fromDefault;
    }

    const fieldType = String(c.field_type || c.fieldType || 'text').toLowerCase();
    let value = coerceImportedCustomValue(raw, fieldType);
    if (value === undefined) {
      errors.push(`Custom field "${label}": invalid value "${String(raw).trim()}"`);
      continue;
    }

    if (fieldType === 'select') {
      let options = parseFieldConfigOptions(c.options);
      const exact = options.find((o) => o === value);
      const insensitive = options.find((o) => o.toLowerCase() === String(value).toLowerCase());
      if (insensitive) {
        value = insensitive;
      } else if (options.length > 0) {
        if (canManageItems) {
          const nextOptions = [...options, String(value)];
          try {
            await apiService.put(`/items/field-config/${itemType}/${fn}/options`, { options: nextOptions });
            options = nextOptions;
            created.push(`option "${value}" on ${label}`);
          } catch (err) {
            errors.push(`Custom field "${label}": "${value}" is not allowed and could not be added to options.`);
            continue;
          }
        } else {
          errors.push(`Custom field "${label}": "${value}" must be one of: ${options.join(', ')}`);
          continue;
        }
      }
    }

    customFields[fn] = value;
    preview.push({ key: fn, label, value });
  }

  return { customFields, created, errors, preview };
}

export async function ensureItemGroupForImport(groupName, groups, canManageItems) {
  const text = String(groupName || '').trim();
  if (!text) return { id: null, groups, created: false };
  const hit = findMasterOptionByName(groups, text);
  if (hit?.id) return { id: hit.id, groups, created: false };

  if (!canManageItems) {
    return { id: null, groups, created: false };
  }

  try {
    const groupRes = await apiService.post('/item-groups', {
      name: text,
      description: '',
      isActive: true,
    });
    const newGroupId = groupRes?.data?.groupId;
    if (newGroupId) {
      return {
        id: newGroupId,
        groups: [...groups, { id: newGroupId, name: text, is_active: true }],
        created: true,
        createdLabel: text,
      };
    }
  } catch (err) {
    const errMsg = String(err?.response?.data?.error || err?.message || '').toLowerCase();
    if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
      try {
        const freshRes = await apiService.get('/item-groups');
        const fresh = freshRes?.success ? (freshRes.data || []) : [];
        const again = findMasterOptionByName(fresh, text);
        if (again?.id) return { id: again.id, groups: fresh, created: false };
      } catch {
        /* fall through */
      }
    }
  }
  return { id: null, groups, created: false };
}

export async function ensureCategoryForImport(categoryName, categoryList, canManageCategories, canViewCategories) {
  const text = String(categoryName || '').trim();
  if (!text) return { name: undefined, categoryList, created: false };

  const hit = findMasterOptionByName(categoryList, text);
  if (hit) return { name: text, categoryList, created: false };

  if (canManageCategories) {
    try {
      const catCreate = await apiService.post('/categories', { name: text });
      if (catCreate?.success && catCreate.data?.categoryId) {
        return {
          name: text,
          categoryList: [...categoryList, { id: catCreate.data.categoryId, name: text }],
          created: true,
          createdLabel: text,
        };
      }
    } catch (err) {
      const errMsg = String(err?.response?.data?.error || '').toLowerCase();
      if (errMsg.includes('already exists') || errMsg.includes('duplicate')) {
        try {
          const catRes = await apiService.get('/categories');
          if (catRes?.success && Array.isArray(catRes.data)) {
            const again = findMasterOptionByName(catRes.data, text);
            if (again) return { name: text, categoryList: catRes.data, created: false };
          }
        } catch {
          /* fall through */
        }
      }
    }
  } else if (canViewCategories) {
    return {
      name: text,
      categoryList: [...categoryList, { id: `local-${Date.now()}`, name: text }],
      created: true,
      createdLabel: `${text} (this item only)`,
    };
  }

  return { name: text, categoryList, created: false };
}
