import apiService from '../../services/apiService';

/** SKU column required in file mapping */
export const CSV_IMPORT_SKU_FROM_FILE = 'from_file';
/** SKU generated via SKU rules when opening Add in form (file SKU column optional) */
export const CSV_IMPORT_SKU_AUTO_RULE = 'auto_rule';

export function isSkuRequiredForImport(skuSource = CSV_IMPORT_SKU_FROM_FILE) {
  return skuSource !== CSV_IMPORT_SKU_AUTO_RULE;
}

export function isImportRowReady(row, mapping, skuSource = CSV_IMPORT_SKU_FROM_FILE) {
  const getCell = createImportRowGetCell(row);
  if (!mapping?.name || !getCell(mapping.name)) return false;
  if (!isSkuRequiredForImport(skuSource)) return true;
  if (!mapping?.sku) return false;
  return !!getCell(mapping.sku);
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
}) {
  const getCell = createImportRowGetCell(row);
  const errors = [];
  const warnings = [];
  const skuFromFile = isSkuRequiredForImport(skuSource);

  const sku = skuFromFile && mapping?.sku ? getCell(mapping.sku) : '';
  const nameCol = mapping?.name;
  const name = nameCol ? getCell(nameCol) : '';

  if (!nameCol) {
    errors.push('Name column is not mapped in the import dialog.');
  } else if (!name) {
    errors.push('This row has no Name value in the mapped column.');
  }

  if (skuFromFile) {
    if (!mapping?.sku) {
      errors.push('SKU column is not mapped (required when using SKU from file).');
    } else if (!sku) {
      errors.push('This row has no SKU value in the mapped column.');
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

  const skuForDup = mapping?.sku ? getCell(mapping.sku) : '';
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
    if (!col) {
      errors.push(`Required custom field "${label}" is not mapped to a file column.`);
      continue;
    }
    if (!getCell(col)) {
      errors.push(`Required custom field "${label}" is empty on this row.`);
    }
  }

  const stockCell = getCell(mapping.openingStock);
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
}) {
  const getCell = createImportRowGetCell(row);
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
  });

  const errors = [...base.errors];
  const warnings = [...base.warnings];

  const sku = mapping?.sku ? getCell(row, mapping.sku) : '';
  const name = mapping?.name ? getCell(row, mapping.name) : '';

  if (skuFromFile) {
    if (!mapping.sku) {
      errors.push('SKU column is not mapped in the import dialog.');
    } else if (!sku) {
      pushMismatchColumn(mismatchColumns, mapping.sku);
    }
  } else if (mapping?.sku && !sku) {
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  if (!mapping.name) {
    errors.push('Name column is not mapped in the import dialog.');
  } else if (!name) {
    pushMismatchColumn(mismatchColumns, mapping.name);
  }

  if (sku && existingSkuKeys.has(sku.toLowerCase())) {
    errors.push(`SKU "${sku}" already exists in your item catalog.`);
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  if (sku && duplicateSkuKeys.has(sku.toLowerCase())) {
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  const stockCell = getCell(mapping.openingStock);
  const stockParsed = parseImportNumeric(stockCell);
  if (stockParsed.invalid) {
    pushMismatchColumn(mismatchColumns, mapping.openingStock);
  }
  if ((stockParsed.value || 0) > 0 && !defaultWarehouseId) {
    pushMismatchColumn(mismatchColumns, mapping.openingStock);
  }

  const openingValueCell = getCell(mapping.openingValue);
  if (parseImportNumeric(openingValueCell).invalid) {
    warnings.push(`Opening value "${openingValueCell}" is not a valid number.`);
    pushMismatchColumn(mismatchColumns, mapping.openingValue);
  }

  for (const numericKey of ['costPrice', 'sellingPrice', 'mrp', 'taxRate', 'minStockLevel', 'maxStockLevel', 'weight']) {
    const col = mapping[numericKey];
    if (!col) continue;
    const raw = getCell(col);
    if (raw && parseImportNumeric(raw, { emptyAsZero: false }).invalid) {
      warnings.push(`"${numericKey}" value "${raw}" is not a valid number.`);
      pushMismatchColumn(mismatchColumns, col);
    }
  }

  const brandStr = getCell(mapping.brand);
  if (brandStr && !findMasterOptionByName(brandOptions, brandStr)) {
    const msg = canManageItems
      ? `Brand "${brandStr}" is not in the list (will be created when you use Add in form).`
      : `Brand "${brandStr}" does not match any brand in the system.`;
    if (canManageItems) warnings.push(msg);
    else errors.push(msg);
    pushMismatchColumn(mismatchColumns, mapping.brand);
  }

  const mfrStr = getCell(mapping.manufacturer);
  if (mfrStr && !findMasterOptionByName(manufacturerOptions, mfrStr)) {
    const msg = canManageItems
      ? `Manufacturer "${mfrStr}" is not in the list (will be created on Add in form).`
      : `Manufacturer "${mfrStr}" does not match any manufacturer in the system.`;
    if (canManageItems) warnings.push(msg);
    else errors.push(msg);
    pushMismatchColumn(mismatchColumns, mapping.manufacturer);
  }

  const unitStr = getCell(mapping.unit);
  if (unitStr) {
    const unitOk = unitOptions.some((u) => u.id === unitStr)
      || !!findMasterOptionByName(unitOptions, unitStr, ['name', 'symbol', 'id']);
    if (!unitOk) {
      const msg = canManageItems
        ? `Unit "${unitStr}" is not in the list (will be created on Add in form).`
        : `Unit "${unitStr}" does not match any unit in the system.`;
      if (canManageItems) warnings.push(msg);
      else errors.push(msg);
      pushMismatchColumn(mismatchColumns, mapping.unit);
    }
  }

  for (const c of fieldConfigs) {
    const fn = c.field_name || c.fieldName;
    if (!fn) continue;
    const label = c.field_label || c.fieldLabel || fn;
    const col = mapping[`cf:${fn}`];
    const required = Boolean(c.is_required || c.isRequired);

    if (required && !col) {
      continue;
    }
    if (!col) continue;

    const raw = row[col];
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    if (required && empty) {
      pushMismatchColumn(mismatchColumns, col);
      continue;
    }
    if (empty) continue;

    const fieldType = String(c.field_type || c.fieldType || 'text').toLowerCase();
    const value = coerceImportedCustomValue(raw, fieldType);
    if (value === undefined) {
      errors.push(`Custom field "${label}": invalid value "${String(raw).trim()}".`);
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
}) {
  const customFields = {};
  const created = [];
  const errors = [];
  const preview = [];

  for (const c of fieldConfigs) {
    const fn = c.field_name || c.fieldName;
    if (!fn) continue;
    const label = c.field_label || c.fieldLabel || fn;
    const col = mapping[`cf:${fn}`];
    if (!col) continue;

    const raw = row[col];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;

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
