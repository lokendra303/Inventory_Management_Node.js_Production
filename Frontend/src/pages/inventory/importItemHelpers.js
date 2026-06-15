import apiService from '../../services/apiService';
import skuGeneratorService from '../../services/skuGeneratorService';
import { convertPrice } from '../../utils/currency';
import {
  CSV_IMPORT_SKU_FROM_FILE,
  CSV_IMPORT_SKU_AUTO_RULE,
  CSV_IMPORT_DEFAULTABLE_CORE_IDS,
  CSV_IMPORT_PURPOSE_CREATE,
  CSV_IMPORT_PURPOSE_UPDATE,
  CSV_IMPORT_MATCH_FIELDS,
  CSV_IMPORT_DEFAULT_MATCH_FIELD,
} from './importConstants';

export {
  CSV_IMPORT_SKU_FROM_FILE,
  CSV_IMPORT_SKU_AUTO_RULE,
  CSV_IMPORT_DEFAULTABLE_CORE_IDS,
  CSV_IMPORT_PURPOSE_CREATE,
  CSV_IMPORT_PURPOSE_UPDATE,
  CSV_IMPORT_MATCH_FIELDS,
  CSV_IMPORT_DEFAULT_MATCH_FIELD,
};

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

export function normalizeImportMatchText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getImportMatchFieldConfig(matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD) {
  return CSV_IMPORT_MATCH_FIELDS.find((f) => f.id === matchFieldId)
    || CSV_IMPORT_MATCH_FIELDS.find((f) => f.id === CSV_IMPORT_DEFAULT_MATCH_FIELD)
    || CSV_IMPORT_MATCH_FIELDS[0];
}

export function getCatalogItemFieldValue(item, matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD) {
  const cfg = getImportMatchFieldConfig(matchFieldId);
  for (const field of cfg.itemFields) {
    const v = item?.[field];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

/** Text from the import row used to find a catalog item (mapped column + defaults, with sensible fallbacks). */
export function resolveImportRowMatchText(
  row,
  mapping = {},
  importDefaults = {},
  matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD
) {
  const cfg = getImportMatchFieldConfig(matchFieldId);
  const primary = pickImportValue(row, mapping, importDefaults, cfg.mappingKey);
  const trimmedPrimary = String(primary || '').trim();
  if (trimmedPrimary) return trimmedPrimary;
  // Supplier files often put the product title in Description, not Name.
  if (matchFieldId === 'name') {
    const desc = pickImportValue(row, mapping, importDefaults, 'description');
    const trimmedDesc = String(desc || '').trim();
    if (trimmedDesc) return trimmedDesc;
  }
  return '';
}

export function hasImportMatchColumnMapped(
  mapping = {},
  importDefaults = {},
  matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  matchFileColumn = ''
) {
  if (matchFileColumn) return true;
  const cfg = getImportMatchFieldConfig(matchFieldId);
  if (mapping?.[cfg.mappingKey] || importDefaults?.[cfg.mappingKey]) return true;
  if (matchFieldId === 'name' && (mapping?.description || importDefaults?.description)) return true;
  return false;
}

/** Value from the import row used to find a catalog item (by match file column or legacy mapping). */
export function getImportRowCatalogMatchValue(
  row,
  mapping = {},
  importDefaults = {},
  matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  matchFileColumn = ''
) {
  if (matchFileColumn) {
    const text = createImportRowGetCell(row)(matchFileColumn);
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;
    return { key: normalizeImportMatchText(trimmed), display: trimmed };
  }
  const trimmed = resolveImportRowMatchText(row, mapping, importDefaults, matchFieldId);
  if (!trimmed) return null;
  return { key: normalizeImportMatchText(trimmed), display: trimmed };
}

/** Index catalog items by normalized match-field value (multiple items may share a key). */
export function buildExistingItemsMatchIndex(
  items = [],
  matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  { activeOnly = false } = {}
) {
  const index = new Map();
  for (const item of items) {
    if (activeOnly && item.status !== 'active') continue;
    const display = getCatalogItemFieldValue(item, matchFieldId);
    if (!display) continue;
    const key = normalizeImportMatchText(display);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  }
  return index;
}

/**
 * Match one import row to catalog items.
 * @returns {{ status: 'empty'|'no_match'|'ambiguous'|'matched', matches: object[], displayValue: string|null, matchKey: string|null, item?: object }}
 */
export function matchImportRowToCatalog(
  row,
  mapping = {},
  importDefaults = {},
  matchIndex = new Map(),
  matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  matchFileColumn = ''
) {
  const rowMatch = getImportRowCatalogMatchValue(row, mapping, importDefaults, matchFieldId, matchFileColumn);
  if (!rowMatch) {
    return { status: 'empty', matches: [], displayValue: null, matchKey: null };
  }
  const matches = matchIndex.get(rowMatch.key) || [];
  if (matches.length === 0) {
    return {
      status: 'no_match',
      matches: [],
      displayValue: rowMatch.display,
      matchKey: rowMatch.key,
    };
  }
  if (matches.length > 1) {
    const skuText = String(
      pickUpdateImportFieldValue(row, mapping, importDefaults, 'sku')
      || pickImportValue(row, mapping, importDefaults, 'sku')
      || ''
    ).trim();
    if (skuText) {
      const skuKey = normalizeImportMatchText(skuText);
      const bySku = matches.filter((m) => normalizeImportMatchText(m.sku) === skuKey);
      if (bySku.length === 1) {
        return {
          status: 'matched',
          matches: bySku,
          displayValue: rowMatch.display,
          matchKey: rowMatch.key,
          item: bySku[0],
          disambiguatedBy: 'sku',
        };
      }
    }
    return {
      status: 'ambiguous',
      matches,
      displayValue: rowMatch.display,
      matchKey: rowMatch.key,
    };
  }
  return {
    status: 'matched',
    matches,
    displayValue: rowMatch.display,
    matchKey: rowMatch.key,
    item: matches[0],
  };
}

/** Apply manual catalog pick when name (or other field) matches more than one item. */
export function resolveCatalogMatchForRow(
  row,
  mapping = {},
  importDefaults = {},
  catalogMatchIndex = new Map(),
  matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  rowIndex = null,
  catalogItemPicks = {},
  matchFileColumn = ''
) {
  let match = matchImportRowToCatalog(row, mapping, importDefaults, catalogMatchIndex, matchField, matchFileColumn);
  if (match.status === 'ambiguous' && rowIndex != null) {
    const pickedId = catalogItemPicks[String(rowIndex)];
    if (pickedId) {
      const item = match.matches.find((m) => String(m.id) === String(pickedId));
      if (item) {
        match = {
          ...match,
          status: 'matched',
          item,
          pickedManually: true,
        };
      }
    }
  }
  return match;
}

export function isImportUpdateRowReady(
  row,
  mapping = {},
  importDefaults = {},
  matchIndex = new Map(),
  matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  rowIndex = null,
  catalogItemPicks = {},
  matchFileColumn = ''
) {
  return resolveCatalogMatchForRow(
    row,
    mapping,
    importDefaults,
    matchIndex,
    matchFieldId,
    rowIndex,
    catalogItemPicks,
    matchFileColumn
  ).status === 'matched';
}

function formatCatalogMatchFieldLabel(matchFieldId = CSV_IMPORT_DEFAULT_MATCH_FIELD) {
  return getImportMatchFieldConfig(matchFieldId).label;
}

/** Effective SKU for a row (file column + import defaults). */
export function getEffectiveImportSku(row, mapping = {}, importDefaults = {}) {
  const sku = pickImportValue(row, mapping, importDefaults, 'sku');
  const trimmed = String(sku || '').trim();
  if (!trimmed) return null;
  return { key: normalizeImportMatchText(trimmed), display: trimmed };
}

/**
 * Effective item name for duplicate matching.
 * Uses Name column, or Description when name is empty (common in supplier files).
 */
export function getEffectiveImportName(row, mapping = {}, importDefaults = {}) {
  const name = pickImportValue(row, mapping, importDefaults, 'name');
  const desc = pickImportValue(row, mapping, importDefaults, 'description');
  const trimmed = String(name || '').trim() || String(desc || '').trim();
  if (!trimmed) return null;
  return { key: normalizeImportMatchText(trimmed), display: trimmed };
}

/** Description-only duplicate match (when description differs from resolved name). */
export function getEffectiveImportDescription(row, mapping = {}, importDefaults = {}) {
  const desc = pickImportValue(row, mapping, importDefaults, 'description');
  const trimmed = String(desc || '').trim();
  if (!trimmed) return null;
  const nameKey = getEffectiveImportName(row, mapping, importDefaults)?.key;
  const descKey = normalizeImportMatchText(trimmed);
  if (nameKey && nameKey === descKey) return null;
  return { key: descKey, display: trimmed };
}

function createImportUnionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const rank = Array(size).fill(0);
  const find = (x) => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra] += 1;
    }
  };
  return { find, union };
}

function linkIndexesInMap(unionFind, bucketMap) {
  for (const indexes of bucketMap.values()) {
    if (indexes.length < 2) continue;
    for (let i = 1; i < indexes.length; i += 1) {
      unionFind.union(indexes[0], indexes[i]);
    }
  }
}

function buildImportDuplicateGroupLabel({ skuDisplay, nameDisplay, descriptionDisplay, rowCount }) {
  const parts = [];
  if (skuDisplay) parts.push(`SKU: ${skuDisplay}`);
  if (nameDisplay) parts.push(`Name: ${nameDisplay}`);
  if (descriptionDisplay) parts.push(`Description: ${descriptionDisplay}`);
  if (parts.length) return parts.join(' · ');
  return `Duplicate group (${rowCount} rows)`;
}

/** SKU keys that appear on more than one row (legacy helper for SKU-only checks). */
export function buildDuplicateSkuKeysInFile(rows, mapping, importDefaults = {}) {
  const counts = new Map();
  for (const row of rows || []) {
    const sku = getEffectiveImportSku(row, mapping, importDefaults);
    if (!sku) continue;
    counts.set(sku.key, (counts.get(sku.key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
}

/**
 * Groups of 2+ rows linked when any share the same SKU, item name, or description
 * (case-insensitive, after trim). Uses union-find so chains are one group
 * (e.g. row A≈B by SKU, row B≈C by name → A,B,C together).
 */
export function buildImportDuplicateGroups(rows, mapping, importDefaults = {}) {
  const list = rows || [];
  const n = list.length;
  if (n < 2) return [];

  const uf = createImportUnionFind(n);
  const skuMap = new Map();
  const nameMap = new Map();
  const descMap = new Map();

  for (let idx = 0; idx < n; idx += 1) {
    const row = list[idx];
    const sku = getEffectiveImportSku(row, mapping, importDefaults);
    const name = getEffectiveImportName(row, mapping, importDefaults);
    const desc = getEffectiveImportDescription(row, mapping, importDefaults);
    if (sku) {
      if (!skuMap.has(sku.key)) skuMap.set(sku.key, []);
      skuMap.get(sku.key).push(idx);
    }
    if (name) {
      if (!nameMap.has(name.key)) nameMap.set(name.key, []);
      nameMap.get(name.key).push(idx);
    }
    if (desc) {
      if (!descMap.has(desc.key)) descMap.set(desc.key, []);
      descMap.get(desc.key).push(idx);
    }
  }

  linkIndexesInMap(uf, skuMap);
  linkIndexesInMap(uf, nameMap);
  linkIndexesInMap(uf, descMap);

  const clusters = new Map();
  for (let idx = 0; idx < n; idx += 1) {
    const root = uf.find(idx);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(idx);
  }

  return [...clusters.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([root, rowIndexes]) => {
      const sorted = [...rowIndexes].sort((a, b) => a - b);
      const groupKey = `g-${sorted[0]}`;

      let skuDisplay = null;
      let nameDisplay = null;
      let descriptionDisplay = null;
      const matchTypes = new Set();

      const skuKeys = new Set();
      const nameKeys = new Set();
      const descKeys = new Set();
      for (const rowIndex of sorted) {
        const row = list[rowIndex];
        const sku = getEffectiveImportSku(row, mapping, importDefaults);
        const name = getEffectiveImportName(row, mapping, importDefaults);
        const desc = getEffectiveImportDescription(row, mapping, importDefaults);
        if (sku) skuKeys.add(sku.key);
        if (name) nameKeys.add(name.key);
        if (desc) descKeys.add(desc.key);
      }
      if (skuKeys.size === 1) {
        matchTypes.add('sku');
        const first = getEffectiveImportSku(list[sorted[0]], mapping, importDefaults);
        skuDisplay = first?.display || null;
      }
      if (nameKeys.size === 1) {
        matchTypes.add('name');
        const first = getEffectiveImportName(list[sorted[0]], mapping, importDefaults);
        nameDisplay = first?.display || null;
      }
      if (descKeys.size === 1) {
        matchTypes.add('description');
        const first = getEffectiveImportDescription(list[sorted[0]], mapping, importDefaults);
        descriptionDisplay = first?.display || null;
      }
      if (matchTypes.size === 0) matchTypes.add('linked');

      const details = sorted.map((rowIndex) => {
        const row = list[rowIndex];
        const stock = parseImportNumeric(pickImportValue(row, mapping, importDefaults, 'openingStock'));
        const batchLine = buildImportBatchLine(row, mapping, importDefaults);
        return {
          rowIndex,
          sourceLine: row?.__sourceLine,
          sku: pickImportValue(row, mapping, importDefaults, 'sku'),
          name: pickImportValue(row, mapping, importDefaults, 'name'),
          description: pickImportValue(row, mapping, importDefaults, 'description'),
          batchNumber: batchLine.batchNumber,
          batchManufactureDate: batchLine.manufactureDate,
          batchExpiryDate: batchLine.expiryDate,
          openingStock: stock.invalid ? null : (stock.value || 0),
        };
      });
      const totalOpeningStock = details.reduce((sum, d) => sum + (Number(d.openingStock) || 0), 0);
      const batchAnalysis = analyzeImportDuplicateGroupBatches(
        { rowIndexes: sorted },
        list,
        mapping,
        importDefaults,
        CSV_IMPORT_PURPOSE_UPDATE
      );
      const label = buildImportDuplicateGroupLabel({
        skuDisplay,
        nameDisplay,
        descriptionDisplay,
        rowCount: sorted.length,
      });

      return {
        groupKey,
        skuKey: groupKey,
        label,
        matchTypes: [...matchTypes],
        skuDisplay,
        nameDisplay,
        descriptionDisplay,
        rowIndexes: sorted,
        details,
        totalOpeningStock,
        batchAnalysis,
      };
    });
}

/**
 * Update import: group only when multiple sheet rows target the same catalog item.
 * Rows with the same name but different SKUs stay separate (each updates its own item).
 */
export function buildImportDuplicateGroupsForUpdate(
  rows,
  mapping = {},
  importDefaults = {},
  catalogMatchIndex = new Map(),
  matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  catalogItemPicks = {},
  matchFileColumn = ''
) {
  const list = rows || [];
  const byCatalogItem = new Map();

  for (let idx = 0; idx < list.length; idx += 1) {
    const match = resolveCatalogMatchForRow(
      list[idx],
      mapping,
      importDefaults,
      catalogMatchIndex,
      matchField,
      idx,
      catalogItemPicks,
      matchFileColumn
    );
    if (match.status !== 'matched' || !match.item?.id) continue;
    const id = String(match.item.id);
    if (!byCatalogItem.has(id)) {
      byCatalogItem.set(id, { item: match.item, indexes: [] });
    }
    byCatalogItem.get(id).indexes.push(idx);
  }

  const groups = [];
  for (const [, { item, indexes }] of byCatalogItem.entries()) {
    if (indexes.length < 2) continue;
    const sorted = [...indexes].sort((a, b) => a - b);
    const groupKey = `cat-${item.id}-${sorted[0]}`;
    const details = sorted.map((rowIndex) => {
      const row = list[rowIndex];
      const stock = parseImportNumeric(pickImportValue(row, mapping, importDefaults, 'openingStock'));
      const batchLine = buildImportBatchLine(row, mapping, importDefaults, {
        importPurpose: CSV_IMPORT_PURPOSE_UPDATE,
      });
      return {
        rowIndex,
        sourceLine: row?.__sourceLine,
        sku: pickImportValue(row, mapping, importDefaults, 'sku'),
        name: pickImportValue(row, mapping, importDefaults, 'name')
          || pickImportValue(row, mapping, importDefaults, 'description'),
        description: pickImportValue(row, mapping, importDefaults, 'description'),
        batchNumber: batchLine.batchNumber,
        batchManufactureDate: batchLine.manufactureDate,
        batchExpiryDate: batchLine.expiryDate,
        openingStock: stock.invalid ? null : (stock.value || 0),
      };
    });
    const totalOpeningStock = details.reduce((sum, d) => sum + (Number(d.openingStock) || 0), 0);
    const batchAnalysis = analyzeImportDuplicateGroupBatches(
      { rowIndexes: sorted },
      list,
      mapping,
      importDefaults,
      CSV_IMPORT_PURPOSE_UPDATE
    );
    const skuDisplay = item.sku || null;
    const nameDisplay = item.name || null;
    groups.push({
      groupKey,
      skuKey: groupKey,
      catalogItemId: item.id,
      label: `Catalog: ${skuDisplay || 'no SKU'} — ${nameDisplay || '—'} (${sorted.length} sheet rows)`,
      matchTypes: ['catalog'],
      skuDisplay,
      nameDisplay,
      descriptionDisplay: null,
      rowIndexes: sorted,
      details,
      totalOpeningStock,
      batchAnalysis,
    });
  }

  return groups.sort((a, b) => (a.rowIndexes[0] || 0) - (b.rowIndexes[0] || 0));
}

/**
 * Group sheet rows that share the same match-column text (name/description).
 * Used when one catalog item appears on multiple sheet lines (e.g. kits) — merge qty into one update.
 */
export function buildImportSheetMatchGroupsForUpdate(
  rows,
  mapping = {},
  importDefaults = {},
  catalogMatchIndex = new Map(),
  matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  catalogItemPicks = {},
  matchFileColumn = ''
) {
  const list = rows || [];
  const byKey = new Map();

  for (let idx = 0; idx < list.length; idx += 1) {
    const rowMatch = getImportRowCatalogMatchValue(
      list[idx],
      mapping,
      importDefaults,
      matchField,
      matchFileColumn
    );
    if (!rowMatch) continue;
    if (!byKey.has(rowMatch.key)) {
      byKey.set(rowMatch.key, {
        matchKey: rowMatch.key,
        displayValue: rowMatch.display,
        indexes: [],
      });
    }
    byKey.get(rowMatch.key).indexes.push(idx);
  }

  const groups = [];
  for (const [, { matchKey, displayValue, indexes }] of byKey.entries()) {
    if (indexes.length < 2) continue;

    const sorted = [...indexes].sort((a, b) => a - b);
    const catalogMatches = catalogMatchIndex.get(matchKey) || [];
    let catalogStatus = 'no_match';
    let resolvedItem = null;

    if (catalogMatches.length === 1) {
      catalogStatus = 'unique';
      resolvedItem = catalogMatches[0];
    } else if (catalogMatches.length > 1) {
      catalogStatus = 'ambiguous';
      const pickIds = new Set();
      for (const rowIndex of sorted) {
        const pick = catalogItemPicks[String(rowIndex)];
        if (pick) pickIds.add(String(pick));
      }
      if (pickIds.size === 1) {
        const pickedId = [...pickIds][0];
        resolvedItem = catalogMatches.find((m) => String(m.id) === pickedId) || null;
        if (resolvedItem) catalogStatus = 'picked';
      }
    }

    const details = sorted.map((rowIndex) => {
      const row = list[rowIndex];
      const batchLine = buildImportBatchLine(row, mapping, importDefaults, {
        importPurpose: CSV_IMPORT_PURPOSE_UPDATE,
      });
      const stock = parseImportNumeric(
        pickUpdateImportFieldValue(row, mapping, importDefaults, 'openingStock')
        ?? pickImportValue(row, mapping, importDefaults, 'openingStock')
      );
      return {
        rowIndex,
        sourceLine: row?.__sourceLine,
        sku: pickImportValue(row, mapping, importDefaults, 'sku'),
        name: pickImportValue(row, mapping, importDefaults, 'name'),
        description: pickImportValue(row, mapping, importDefaults, 'description'),
        batchNumber: batchLine.batchNumber,
        batchManufactureDate: batchLine.manufactureDate,
        batchExpiryDate: batchLine.expiryDate,
        openingStock: stock.invalid ? null : (stock.value ?? 0),
        sheetMatchValue: displayValue,
      };
    });

    const mergedQty = buildMergedImportQuantitiesForUpdate(sorted, list, mapping, importDefaults);
    const hasOpeningStockSource = !!(
      mapping?.openingStock || hasImportUpdateDefault(importDefaults, 'openingStock')
    );
    const batchAnalysis = analyzeImportDuplicateGroupBatches(
      { rowIndexes: sorted },
      list,
      mapping,
      importDefaults,
      CSV_IMPORT_PURPOSE_UPDATE
    );

    groups.push({
      groupKey: `sheet-match-${matchKey}`,
      matchKey,
      displayValue,
      rowIndexes: sorted,
      details,
      catalogMatches,
      catalogStatus,
      resolvedItem,
      totalOpeningStock: mergedQty.openingStock,
      totalOpeningValue: mergedQty.openingValue,
      hasOpeningStockSource,
      batchAnalysis,
      label: `${displayValue} (${sorted.length} sheet rows)`,
    });
  }

  return groups.sort((a, b) => (a.rowIndexes[0] || 0) - (b.rowIndexes[0] || 0));
}

export function isSheetMatchGroupResolved(group, addedRowIndexes = {}, supersededRowIndexes = {}) {
  return (group?.rowIndexes || []).every(
    (i) => addedRowIndexes[String(i)] || supersededRowIndexes[String(i)]
  );
}

/** Pending row indexes in any import duplicate group (create or update). */
export function getImportGroupPendingRowIndexes(
  group,
  addedRowIndexes = {},
  supersededRowIndexes = {}
) {
  return (group?.rowIndexes || []).filter(
    (i) => !addedRowIndexes[String(i)] && !supersededRowIndexes[String(i)]
  );
}

/** Selected row indexes for merge (defaults to all pending rows in the group). */
export function getImportGroupSelectedRowIndexes(
  group,
  groupPlan = {},
  addedRowIndexes = {},
  supersededRowIndexes = {}
) {
  const pending = getImportGroupPendingRowIndexes(group, addedRowIndexes, supersededRowIndexes);
  if (!pending.length) return [];
  const fromPlan = groupPlan?.selectedRowIndexes;
  if (!Array.isArray(fromPlan) || !fromPlan.length) return pending;
  return fromPlan.filter((i) => pending.includes(i));
}

export const getSheetMatchGroupPendingRowIndexes = getImportGroupPendingRowIndexes;
export const getSheetMatchGroupSelectedRowIndexes = getImportGroupSelectedRowIndexes;
export const getImportDuplicateGroupPendingRowIndexes = getImportGroupPendingRowIndexes;
export const getImportDuplicateGroupSelectedRowIndexes = getImportGroupSelectedRowIndexes;

/** Block per-row update while selected for a multi-row merge that is still pending. */
export function isImportRowInPendingSheetMatchGroup(
  rowIndex,
  sheetMatchGroups = [],
  addedRowIndexes = {},
  supersededRowIndexes = {},
  groupPlans = {}
) {
  const group = (sheetMatchGroups || []).find((g) => g.rowIndexes?.includes(rowIndex));
  if (!group || group.rowIndexes.length < 2) return false;
  if (isSheetMatchGroupResolved(group, addedRowIndexes, supersededRowIndexes)) return false;
  const selected = getSheetMatchGroupSelectedRowIndexes(
    group,
    groupPlans[group.groupKey],
    addedRowIndexes,
    supersededRowIndexes
  );
  if (selected.length < 2) return false;
  return selected.includes(rowIndex);
}

export function isSheetMatchGroupReadyForMergeUpdate(
  group,
  mapping = {},
  importDefaults = {},
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  selectedRowIndexes = []
) {
  if (!group?.resolvedItem?.id) return false;
  if (!selectedRowIndexes?.length) return false;
  const fieldCount = countUpdateImportFieldSources(mapping, importDefaults);
  const autoSku = skuSource === CSV_IMPORT_SKU_AUTO_RULE;
  return fieldCount > 0 || autoSku || group.hasOpeningStockSource;
}

/** Prefer SKU match when the file has a SKU / serial column (best for updating existing items). */
export function suggestUpdateImportMatchField(mapping = {}) {
  if (mapping?.sku) return 'sku';
  return CSV_IMPORT_DEFAULT_MATCH_FIELD;
}

/** Sheet row found at least one catalog item (unique match or multiple — pick needed). */
export function isImportRowFoundInCatalog(catalogMatch) {
  const st = catalogMatch?.status;
  return st === 'matched' || st === 'ambiguous';
}

export function getImportRowSheetMatchLabel(
  row,
  mapping = {},
  importDefaults = {},
  matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  matchFileColumn = ''
) {
  if (matchFileColumn) {
    const text = createImportRowGetCell(row)(matchFileColumn);
    return String(text || '').trim() || '—';
  }
  return resolveImportRowMatchText(row, mapping, importDefaults, matchField) || '—';
}

/** File columns to highlight when this row duplicates another on SKU, name, or description. */
export function getImportDuplicateMatchColumns(rowIndex, duplicateGroups, rows, mapping, importDefaults = {}) {
  const group = (duplicateGroups || []).find((g) => g.rowIndexes?.includes(rowIndex));
  if (!group || group.rowIndexes.length < 2) return [];
  const row = rows[rowIndex];
  if (!row) return [];
  const cols = [];
  const sku = getEffectiveImportSku(row, mapping, importDefaults);
  const name = getEffectiveImportName(row, mapping, importDefaults);
  const desc = getEffectiveImportDescription(row, mapping, importDefaults);

  for (const otherIdx of group.rowIndexes) {
    if (otherIdx === rowIndex) continue;
    const other = rows[otherIdx];
    if (!other) continue;
    const oSku = getEffectiveImportSku(other, mapping, importDefaults);
    const oName = getEffectiveImportName(other, mapping, importDefaults);
    const oDesc = getEffectiveImportDescription(other, mapping, importDefaults);
    if (sku && oSku && sku.key === oSku.key && mapping?.sku) cols.push(mapping.sku);
    if (name && oName && name.key === oName.key && mapping?.name) cols.push(mapping.name);
    if (desc && oDesc && desc.key === oDesc.key && mapping?.description) cols.push(mapping.description);
  }
  return [...new Set(cols.filter(Boolean))];
}

export function isImportRowInDuplicateFileGroup(rowIndex, duplicateGroups = []) {
  const group = duplicateGroups.find((g) => g.rowIndexes?.includes(rowIndex));
  return !!(group && group.rowIndexes.length > 1);
}

export function isImportRowInPendingDuplicateGroup(
  rowIndex,
  duplicateGroups,
  addedRowIndexes = {},
  supersededRowIndexes = {},
  groupPlans = {}
) {
  const group = (duplicateGroups || []).find((g) => g.rowIndexes.includes(rowIndex));
  if (!group) return false;
  const selected = getImportGroupSelectedRowIndexes(
    group,
    groupPlans[group.groupKey],
    addedRowIndexes,
    supersededRowIndexes
  );
  if (selected.length < 2) return false;
  return selected.includes(rowIndex);
}

/** Sum opening stock / value across duplicate rows for a merged save. */
export function buildMergedImportQuantities(rowIndexes, rows, mapping, importDefaults = {}) {
  let openingStock = 0;
  let openingValue = 0;
  let hasOpeningValue = false;
  let anyInvalidStock = false;
  for (const idx of rowIndexes || []) {
    const row = rows[idx];
    if (!row) continue;
    const stock = parseImportNumeric(pickImportValue(row, mapping, importDefaults, 'openingStock'));
    const val = parseImportNumeric(pickImportValue(row, mapping, importDefaults, 'openingValue'));
    if (stock.invalid) anyInvalidStock = true;
    else openingStock += stock.value || 0;
    if (!val.invalid && (val.value || 0) > 0) {
      openingValue += val.value || 0;
      hasOpeningValue = true;
    }
  }
  return {
    openingStock,
    openingValue: hasOpeningValue ? openingValue : 0,
    anyInvalidStock,
  };
}

/** Build description text when merging duplicate import rows. */
export function buildMergedImportDescription({
  primaryRow,
  rowIndexes,
  rows,
  mapping,
  importDefaults = {},
  userNote = '',
  mappedOnly = false,
}) {
  const pickDesc = mappedOnly
    ? getMappedImportCellRaw(primaryRow, mapping, 'description')
    : pickImportValue(primaryRow, mapping, importDefaults, 'description');
  const primaryDesc = pickDesc === null ? '' : pickDesc;
  const lineParts = (rowIndexes || []).map((idx) => {
    const row = rows[idx];
    if (!row) return null;
    const line = row.__sourceLine != null ? `Line ${row.__sourceLine}` : `Row ${idx + 1}`;
    const nameRaw = mappedOnly
      ? getMappedImportCellRaw(row, mapping, 'name')
      : pickImportValue(row, mapping, importDefaults, 'name');
    const name = (nameRaw === null ? '' : nameRaw) || '—';
    const stockRaw = mappedOnly
      ? getMappedImportCellRaw(row, mapping, 'openingStock')
      : pickImportValue(row, mapping, importDefaults, 'openingStock');
    const stock = parseImportNumeric(stockRaw === null ? '' : stockRaw);
    const qty = stock.invalid ? '?' : String(stock.value || 0);
    return `${line}: ${name} (qty ${qty})`;
  }).filter(Boolean);
  const sections = [];
  if (primaryDesc) sections.push(primaryDesc);
  if (String(userNote || '').trim()) {
    sections.push(`Import note: ${String(userNote).trim()}`);
  }
  if (lineParts.length > 1) {
    sections.push(`Merged from duplicate import rows:\n${lineParts.join('\n')}`);
  }
  return sections.join('\n\n');
}

/** Append warehouse batch breakdown when merge rows have batch numbers mapped. */
export function appendMergedImportWarehouseBatchNote(
  description,
  rowIndexes,
  rows,
  mapping = {},
  importDefaults = {},
  importPurpose = CSV_IMPORT_PURPOSE_CREATE
) {
  const lines = buildConsolidatedImportBatchLinesFromRowIndexes(
    rowIndexes,
    rows,
    mapping,
    importDefaults,
    { importPurpose }
  ).filter((line) => line.batchNumber && line.quantity > 0);
  if (!lines.length) return description;
  const batchParts = lines.map((line) => {
    const expiry = line.expiryDate ? `, exp ${line.expiryDate}` : '';
    return `batch ${line.batchNumber}: qty ${line.quantity}${expiry}`;
  });
  const note = lines.length === 1
    ? `Warehouse batch on save: ${batchParts[0]}`
    : `Warehouse batches on save (split by batch number):\n${batchParts.join('\n')}`;
  return [description, note].filter(Boolean).join('\n\n');
}

export function normalizeImportBatchNumber(value) {
  const text = String(value ?? '').trim().toUpperCase();
  return text || null;
}

/** Parse date cells from import sheets (ISO, DD/MM/YYYY, Excel serial). */
export function parseImportDateValue(value) {
  if (value === undefined || value === null || value === '') {
    return { valid: false, value: null, invalid: false };
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { valid: true, value: value.toISOString().slice(0, 10), invalid: false };
  }

  const raw = String(value).trim();
  if (!raw) return { valid: false, value: null, invalid: false };

  const excelSerial = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(excelSerial) && excelSerial > 20000 && excelSerial < 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsedExcel = new Date(excelEpoch + excelSerial * 86400000);
    if (!Number.isNaN(parsedExcel.getTime())) {
      return { valid: true, value: parsedExcel.toISOString().slice(0, 10), invalid: false };
    }
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { valid: true, value: `${iso[1]}-${iso[2]}-${iso[3]}`, invalid: false };

  const slash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slash) {
    const first = parseInt(slash[1], 10);
    const second = parseInt(slash[2], 10);
    const year = slash[3];
    const day = first > 12 ? first : second;
    const month = first > 12 ? second : first;
    return {
      valid: true,
      value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      invalid: false,
    };
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return { valid: true, value: parsed.toISOString().slice(0, 10), invalid: false };
  }

  return { valid: false, value: null, invalid: true };
}

export function isImportBatchColumnMapped(mapping = {}, importDefaults = {}, importPurpose = CSV_IMPORT_PURPOSE_CREATE) {
  if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE) {
    return Boolean(
      mapping?.batchNumber || hasImportUpdateDefault(importDefaults, 'batchNumber')
    );
  }
  return Boolean(mapping?.batchNumber || importDefaults?.batchNumber);
}

function pickImportBatchField(row, mapping, importDefaults, fieldKey, importPurpose = CSV_IMPORT_PURPOSE_CREATE) {
  if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE) {
    if (!willUpdateImportField(row, mapping, importDefaults, fieldKey)) return null;
    return pickUpdateImportFieldValue(row, mapping, importDefaults, fieldKey);
  }
  return pickImportValue(row, mapping, importDefaults, fieldKey);
}

export function buildImportBatchLine(row, mapping = {}, importDefaults = {}, options = {}) {
  const { importPurpose = CSV_IMPORT_PURPOSE_CREATE } = options;
  if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE
    && !willUpdateImportField(row, mapping, importDefaults, 'batchNumber')) {
    return {
      batchNumber: null,
      quantity: null,
      unitCost: 0,
      expiryDate: null,
      manufactureDate: null,
      invalidStock: false,
      invalidExpiry: false,
      invalidManufacture: false,
    };
  }

  const batchNumber = normalizeImportBatchNumber(
    pickImportBatchField(row, mapping, importDefaults, 'batchNumber', importPurpose)
  );
  const stockRaw = pickImportBatchField(row, mapping, importDefaults, 'openingStock', importPurpose);
  const costRaw = pickImportBatchField(row, mapping, importDefaults, 'costPrice', importPurpose);
  const expiryRaw = pickImportBatchField(row, mapping, importDefaults, 'batchExpiryDate', importPurpose);
  const manufactureRaw = pickImportBatchField(row, mapping, importDefaults, 'batchManufactureDate', importPurpose);
  const stock = parseImportNumeric(stockRaw ?? '');
  const cost = parseImportNumeric(costRaw ?? '');
  const expiry = parseImportDateValue(expiryRaw ?? '');
  const manufacture = parseImportDateValue(manufactureRaw ?? '');

  return {
    batchNumber,
    quantity: stock.invalid ? null : (stock.value || 0),
    unitCost: cost.invalid ? 0 : (cost.value || 0),
    expiryDate: expiry.valid ? expiry.value : null,
    manufactureDate: manufacture.valid ? manufacture.value : null,
    invalidStock: stock.invalid,
    invalidExpiry: expiry.invalid,
    invalidManufacture: manufacture.invalid,
  };
}

export function buildImportBatchLinesFromRowIndexes(
  rowIndexes,
  rows,
  mapping = {},
  importDefaults = {},
  options = {}
) {
  return (rowIndexes || [])
    .map((rowIndex) => {
      const row = rows?.[rowIndex];
      if (!row) return null;
      return { rowIndex, ...buildImportBatchLine(row, mapping, importDefaults, options) };
    })
    .filter(Boolean);
}

export function analyzeImportDuplicateGroupBatches(
  group,
  rows,
  mapping = {},
  importDefaults = {},
  importPurpose = CSV_IMPORT_PURPOSE_CREATE
) {
  const rowIndexes = group?.rowIndexes || [];
  const options = { importPurpose };
  const lines = buildImportBatchLinesFromRowIndexes(rowIndexes, rows, mapping, importDefaults, options);
  const withBatch = lines.filter((line) => line.batchNumber);
  const batchKeys = new Set(withBatch.map((line) => line.batchNumber));
  const distinctBatches = batchKeys.size;
  const duplicateBatchInGroup = withBatch.length !== distinctBatches;
  const canImportAsBatches = isImportBatchColumnMapped(mapping, importDefaults, importPurpose)
    && withBatch.length >= 2
    && distinctBatches >= 2
    && !duplicateBatchInGroup;

  return {
    lines,
    withBatch,
    distinctBatches,
    duplicateBatchInGroup,
    canImportAsBatches,
  };
}

export function buildConsolidatedImportBatchLinesFromRowIndexes(
  rowIndexes,
  rows,
  mapping = {},
  importDefaults = {},
  options = {}
) {
  const lines = buildImportBatchLinesFromRowIndexes(rowIndexes, rows, mapping, importDefaults, options)
    .filter((line) => line.batchNumber);
  if (!lines.length) return [];

  const byBatch = new Map();
  for (const line of lines) {
    const key = line.batchNumber;
    if (!byBatch.has(key)) {
      byBatch.set(key, {
        batchNumber: key,
        quantity: 0,
        unitCost: line.unitCost || 0,
        expiryDate: line.expiryDate || null,
        manufactureDate: line.manufactureDate || null,
        rowIndex: line.rowIndex,
        invalidStock: false,
        invalidExpiry: line.invalidExpiry,
        invalidManufacture: line.invalidManufacture,
      });
    }
    const agg = byBatch.get(key);
    agg.quantity += Number(line.quantity) || 0;
    if (!agg.expiryDate && line.expiryDate) agg.expiryDate = line.expiryDate;
    if (!agg.manufactureDate && line.manufactureDate) agg.manufactureDate = line.manufactureDate;
    if (line.unitCost > 0 && !agg.unitCost) agg.unitCost = line.unitCost;
  }

  return [...byBatch.values()];
}

export function resolveImportBatchLinesForSave({
  importGroup = null,
  savedRowIndex = null,
  rows = [],
  mapping = {},
  importDefaults = {},
  importPurpose = CSV_IMPORT_PURPOSE_CREATE,
}) {
  const options = { importPurpose };
  if (importGroup?.mode === 'import_batches' && Array.isArray(importGroup.rowIndexes)) {
    return buildImportBatchLinesFromRowIndexes(
      importGroup.rowIndexes,
      rows,
      mapping,
      importDefaults,
      options
    );
  }
  if (importGroup?.mode === 'merge' && Array.isArray(importGroup.rowIndexes)) {
    if (!isImportBatchColumnMapped(mapping, importDefaults, importPurpose)) {
      return [];
    }
    return buildConsolidatedImportBatchLinesFromRowIndexes(
      importGroup.rowIndexes,
      rows,
      mapping,
      importDefaults,
      options
    ).filter((line) => line.batchNumber && line.quantity > 0);
  }
  if (savedRowIndex != null && rows?.[savedRowIndex]) {
    const line = buildImportBatchLine(rows[savedRowIndex], mapping, importDefaults, options);
    if (line.batchNumber && line.quantity > 0) {
      return [{ rowIndex: savedRowIndex, ...line }];
    }
  }
  return [];
}

export function validateImportBatchLines(batchLines, { requireQuantity = true } = {}) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(batchLines) || batchLines.length === 0) {
    errors.push('No batch rows selected.');
    return { ok: false, errors, warnings };
  }

  for (const line of batchLines) {
    const label = line.batchNumber || `row ${(line.rowIndex ?? 0) + 1}`;
    if (!line.batchNumber) {
      errors.push(`Line ${(line.rowIndex ?? 0) + 1}: batch number is required for batch import.`);
    }
    if (line.invalidStock) {
      errors.push(`Batch ${label}: opening stock is not a valid number.`);
    } else if (requireQuantity && (!(line.quantity > 0))) {
      errors.push(`Batch ${label}: quantity must be greater than 0.`);
    }
    if (line.invalidExpiry) warnings.push(`Batch ${label}: expiry date could not be parsed and was skipped.`);
    if (line.invalidManufacture) warnings.push(`Batch ${label}: manufacture date could not be parsed and was skipped.`);
  }

  const batchKeys = batchLines.map((line) => line.batchNumber).filter(Boolean);
  if (new Set(batchKeys).size !== batchKeys.length) {
    errors.push('Duplicate batch numbers in the selected rows.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function buildImportBatchImportDescription({
  primaryRow,
  batchLines = [],
  rows = [],
  mapping = {},
  importDefaults = {},
  userNote = '',
}) {
  const lineParts = batchLines.map((line) => {
    const row = rows[line.rowIndex];
    const lineNo = row?.__sourceLine != null ? `Line ${row.__sourceLine}` : `Row ${(line.rowIndex ?? 0) + 1}`;
    const expiry = line.expiryDate ? `, exp ${line.expiryDate}` : '';
    return `${lineNo}: batch ${line.batchNumber} (qty ${line.quantity || 0}${expiry})`;
  });
  const sections = [];
  const primaryDesc = pickImportValue(primaryRow, mapping, importDefaults, 'description');
  if (primaryDesc) sections.push(primaryDesc);
  if (String(userNote || '').trim()) sections.push(`Import note: ${String(userNote).trim()}`);
  if (lineParts.length) sections.push(`Imported warehouse batches:\n${lineParts.join('\n')}`);
  return sections.join('\n\n');
}

/** Gate before opening add-item or update-item form from an import row. */
export function validateImportRowBeforeOpen({
  row,
  rowIndex = null,
  mapping,
  fieldConfigs = [],
  defaultWarehouseId,
  duplicateSkuKeys = new Set(),
  duplicateGroups = [],
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  hasSkuRules = true,
  importDefaults = {},
  importPurpose = CSV_IMPORT_PURPOSE_CREATE,
  matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  catalogMatchIndex = new Map(),
  catalogItemPicks = {},
  matchFileColumn = '',
}) {
  const getCell = createImportRowGetCell(row);
  const pick = (fieldKey) => pickImportValue(row, mapping, importDefaults, fieldKey);
  const errors = [];
  const warnings = [];
  const isUpdateImport = importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
  const matchCfg = getImportMatchFieldConfig(matchField);
  const skuFromFile = isSkuRequiredForImport(skuSource);

  const sku = skuFromFile ? pick('sku') : pick('sku');
  const name = pick('name');

  if (isUpdateImport) {
    const catalogMatch = resolveCatalogMatchForRow(
      row,
      mapping,
      importDefaults,
      catalogMatchIndex,
      matchField,
      rowIndex,
      catalogItemPicks,
      matchFileColumn
    );
    const matchLabel = formatCatalogMatchFieldLabel(matchField);
    if (!hasImportMatchColumnMapped(mapping, importDefaults, matchField, matchFileColumn)) {
      errors.push(
        `Select a file column for catalog match (${matchLabel}).`
      );
    } else if (catalogMatch.status === 'empty') {
      warnings.push(`No ${matchLabel} value in this row — skipped (not listed for update).`);
    } else if (catalogMatch.status === 'no_match') {
      warnings.push(
        `No catalog item for ${matchLabel} "${catalogMatch.displayValue}" — skipped (only matched rows are listed).`
      );
    } else if (catalogMatch.status === 'ambiguous') {
      const hints = catalogMatch.matches
        .slice(0, 5)
        .map((item) => `${item.sku || 'no SKU'} — ${item.name || '—'}`)
        .join('; ');
      errors.push(
        `${catalogMatch.matches.length} catalog items share ${matchLabel} "${catalogMatch.displayValue}". Map SKU / Serial number to disambiguate, or pick the item in the Matched item column. ${hints}${catalogMatch.matches.length > 5 ? '…' : ''}`
      );
    } else if (catalogMatch.disambiguatedBy === 'sku') {
      warnings.push(`Matched by item name and SKU (${catalogMatch.item?.sku || '—'}).`);
    }

    if (!skuFromFile) {
      if (!hasSkuRules) {
        warnings.push('No SKU rules found. Unmapped or empty SKU keeps the existing catalog SKU.');
      } else if (!willUpdateImportField(row, mapping, importDefaults, 'sku')) {
        warnings.push('SKU will be auto-generated from your SKU rule (SKU not mapped and no SKU default on this row).');
      }
    }
  } else {
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
  }

  const inDuplicateGroup = rowIndex != null && isImportRowInDuplicateFileGroup(rowIndex, duplicateGroups);
  const skuForDup = pick('sku');
  if (inDuplicateGroup) {
    const g = duplicateGroups.find((gr) => gr.rowIndexes?.includes(rowIndex));
    const hint = g?.label ? ` (${g.label})` : '';
    warnings.push(
      `This row is in a duplicate group in the file${hint} — same SKU, item name, or description as another row. Use Duplicate item groups to merge quantities, pick one row, or add a note.`
    );
  } else if (skuForDup && duplicateSkuKeys.has(skuForDup.toLowerCase())) {
    warnings.push(
      `SKU "${skuForDup}" appears more than once in this file. Use Duplicate item groups to merge quantities, pick one row, or add a note.`
    );
  }

  if (!isUpdateImport) {
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
  }

  const stockCell = pick('openingStock');
  const stockParsed = parseImportNumeric(stockCell);
  if (stockParsed.invalid) {
    warnings.push(`Opening stock "${stockCell}" is not a valid number; it will be treated as 0.`);
  }
  if (!isUpdateImport && (stockParsed.value || 0) > 0 && !defaultWarehouseId) {
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

/** True when a file column is mapped to this import field (update mode: unmapped fields are left unchanged). */
export function isImportFieldMapped(mapping = {}, fieldKey) {
  return !!(mapping?.[fieldKey]);
}

/** True when an import field has a mapped column and/or default (create or update). */
export function isImportFieldConfigured(
  mapping = {},
  importDefaults = {},
  fieldKey,
  importPurpose = CSV_IMPORT_PURPOSE_CREATE
) {
  if (mapping?.[fieldKey]) return true;
  if (importPurpose === CSV_IMPORT_PURPOSE_UPDATE) {
    return hasImportUpdateDefault(importDefaults, fieldKey);
  }
  const def = importDefaults?.[fieldKey];
  return def !== undefined && def !== null && String(def).trim() !== '';
}

export function buildImportGroupDetailTableColumns({
  mapping = {},
  importDefaults = {},
  importPurpose = CSV_IMPORT_PURPOSE_CREATE,
  variant = 'duplicate',
  statusColumn = null,
}) {
  const columns = [
    {
      title: 'Line',
      dataIndex: 'sourceLine',
      width: 64,
      render: (v) => (v != null ? v : '—'),
    },
  ];

  if (variant === 'sheet_match') {
    columns.push({
      title: 'Sheet match value',
      dataIndex: 'sheetMatchValue',
      ellipsis: true,
    });
  } else {
    columns.push(
      { title: 'SKU', dataIndex: 'sku', width: 100, ellipsis: true, render: (v) => v || '—' },
      { title: 'Name', dataIndex: 'name', ellipsis: true, render: (v) => v || '—' },
    );
  }

  if (isImportFieldConfigured(mapping, importDefaults, 'batchNumber', importPurpose)) {
    columns.push({
      title: 'Batch #',
      dataIndex: 'batchNumber',
      width: 110,
      ellipsis: true,
      render: (v) => v || '—',
    });
  }
  if (isImportFieldConfigured(mapping, importDefaults, 'batchManufactureDate', importPurpose)) {
    columns.push({
      title: 'Manufacture',
      dataIndex: 'batchManufactureDate',
      width: 110,
      render: (v) => v || '—',
    });
  }
  if (isImportFieldConfigured(mapping, importDefaults, 'batchExpiryDate', importPurpose)) {
    columns.push({
      title: 'Expiry',
      dataIndex: 'batchExpiryDate',
      width: 100,
      render: (v) => v || '—',
    });
  }
  if (isImportFieldConfigured(mapping, importDefaults, 'openingStock', importPurpose)) {
    columns.push({
      title: variant === 'sheet_match' ? 'Qty' : 'Opening qty',
      dataIndex: 'openingStock',
      width: variant === 'sheet_match' ? 80 : 100,
      render: (v) => (v == null ? '—' : v),
    });
  }

  if (statusColumn) columns.push(statusColumn);
  return columns;
}

/**
 * Raw file cell when the field is mapped.
 * `null` = column not mapped (do not change catalog field).
 * `''` = mapped but empty on this row (keep existing catalog value).
 */
export function getMappedImportCellRaw(row, mapping = {}, fieldKey) {
  const col = mapping?.[fieldKey];
  if (!col) return null;
  return createImportRowGetCell(row)(col);
}

export function hasMappedImportCellValue(row, mapping = {}, fieldKey) {
  const raw = getMappedImportCellRaw(row, mapping, fieldKey);
  return raw !== null && raw !== '';
}

export function hasImportUpdateDefault(importDefaults = {}, fieldKey) {
  const d = importDefaults?.[fieldKey];
  return d !== undefined && d !== null && String(d).trim() !== '';
}

/** File cell when mapped; else explicit update default; else null (keep existing). */
export function pickUpdateImportFieldValue(row, mapping = {}, importDefaults = {}, fieldKey) {
  const mappedRaw = getMappedImportCellRaw(row, mapping, fieldKey);
  if (mappedRaw !== null && mappedRaw !== '') return mappedRaw;
  if (hasImportUpdateDefault(importDefaults, fieldKey)) {
    return String(importDefaults[fieldKey]).trim();
  }
  return null;
}

export function willUpdateImportField(row, mapping = {}, importDefaults = {}, fieldKey) {
  return pickUpdateImportFieldValue(row, mapping, importDefaults, fieldKey) !== null;
}

export function countUpdateImportFieldSources(mapping = {}, importDefaults = {}) {
  const keys = new Set([
    ...Object.keys(mapping || {}).filter((k) => mapping[k]),
    ...Object.keys(importDefaults || {}).filter((k) => hasImportUpdateDefault(importDefaults, k)),
  ]);
  return keys.size;
}

/** Update import: mapped file cells or explicit per-field defaults change catalog data. */
export function createUpdateImportFieldAccessors(row, mapping = {}, importDefaults = {}) {
  const getRaw = (fieldKey) => pickUpdateImportFieldValue(row, mapping, importDefaults, fieldKey);
  return {
    isMapped: (fieldKey) => isImportFieldMapped(mapping, fieldKey),
    hasDefault: (fieldKey) => hasImportUpdateDefault(importDefaults, fieldKey),
    willUpdate: (fieldKey) => getRaw(fieldKey) !== null,
    hasValue: (fieldKey) => getRaw(fieldKey) !== null,
    getRaw,
    overlayText(fieldKey, existing) {
      const raw = getRaw(fieldKey);
      if (raw === null) return existing;
      return normalizeImportOptionalText(raw) ?? existing;
    },
    overlayNumber(fieldKey, existing, { allowZero = true } = {}) {
      const raw = getRaw(fieldKey);
      if (raw === null) return existing;
      const parsed = parseImportNumeric(raw, { emptyAsZero: false });
      if (parsed.invalid) return existing;
      return normalizeImportOptionalNumber(parsed.value, { allowZero });
    },
  };
}

/** Sum opening stock/value across rows when mapped or set as update default (update merge). */
export function buildMergedImportQuantitiesForUpdate(
  rowIndexes,
  rows,
  mapping = {},
  importDefaults = {}
) {
  let openingStock;
  let openingValue;
  let hasOpeningValue = false;
  let anyInvalidStock = false;
  const hasStockSource = mapping?.openingStock || hasImportUpdateDefault(importDefaults, 'openingStock');
  const hasValueSource = mapping?.openingValue || hasImportUpdateDefault(importDefaults, 'openingValue');

  if (hasStockSource) {
    openingStock = 0;
    for (const idx of rowIndexes || []) {
      const row = rows[idx];
      if (!row) continue;
      const raw = pickUpdateImportFieldValue(row, mapping, importDefaults, 'openingStock');
      if (raw === null || raw === '') continue;
      const stock = parseImportNumeric(raw);
      if (stock.invalid) anyInvalidStock = true;
      else openingStock += stock.value || 0;
    }
  }

  if (hasValueSource) {
    openingValue = 0;
    for (const idx of rowIndexes || []) {
      const row = rows[idx];
      if (!row) continue;
      const raw = pickUpdateImportFieldValue(row, mapping, importDefaults, 'openingValue');
      if (raw === null || raw === '') continue;
      const val = parseImportNumeric(raw);
      if (!val.invalid && (val.value || 0) > 0) {
        openingValue += val.value || 0;
        hasOpeningValue = true;
      }
    }
  }

  return {
    openingStock: hasStockSource ? openingStock : undefined,
    openingValue: hasValueSource && hasOpeningValue ? openingValue : undefined,
    anyInvalidStock,
  };
}

function pushMismatchColumn(mismatchColumns, col) {
  if (col && !mismatchColumns.includes(col)) mismatchColumns.push(col);
}

/** Sync row assessment for import preview highlighting (no API calls). */
export function assessImportRowIssues({
  row,
  rowIndex = null,
  rows = [],
  mapping = {},
  fieldConfigs = [],
  defaultWarehouseId,
  duplicateSkuKeys = new Set(),
  duplicateGroups = [],
  existingSkuKeys = new Set(),
  brandOptions = [],
  manufacturerOptions = [],
  unitOptions = [],
  canManageItems = false,
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  hasSkuRules = true,
  importDefaults = {},
  importPurpose = CSV_IMPORT_PURPOSE_CREATE,
  matchField = CSV_IMPORT_DEFAULT_MATCH_FIELD,
  catalogMatchIndex = new Map(),
  catalogItemPicks = {},
  matchFileColumn = '',
}) {
  const getCell = createImportRowGetCell(row);
  const pick = (fieldKey) => pickImportValue(row, mapping, importDefaults, fieldKey);
  const mismatchColumns = [];
  const isUpdateImport = importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
  const matchCfg = getImportMatchFieldConfig(matchField);
  const skuFromFile = isSkuRequiredForImport(skuSource);
  const catalogMatch = isUpdateImport
    ? resolveCatalogMatchForRow(
      row,
      mapping,
      importDefaults,
      catalogMatchIndex,
      matchField,
      rowIndex,
      catalogItemPicks,
      matchFileColumn
    )
    : null;

  const base = validateImportRowBeforeOpen({
    row,
    rowIndex,
    mapping,
    fieldConfigs,
    defaultWarehouseId,
    duplicateSkuKeys,
    duplicateGroups,
    skuSource,
    hasSkuRules,
    importDefaults,
    importPurpose,
    matchField,
    catalogMatchIndex,
    catalogItemPicks,
    matchFileColumn,
  });

  const errors = [...base.errors];
  const warnings = [...base.warnings];

  const sku = pick('sku');
  const name = pick('name');

  if (isUpdateImport) {
    if (!hasImportMatchColumnMapped(mapping, importDefaults, matchField, matchFileColumn)) {
      // already in base.errors
    } else if (catalogMatch?.status === 'empty') {
      if (matchFileColumn) pushMismatchColumn(mismatchColumns, matchFileColumn);
      if (mapping?.[matchCfg.mappingKey]) pushMismatchColumn(mismatchColumns, mapping[matchCfg.mappingKey]);
      if (matchField === 'name' && mapping?.description) pushMismatchColumn(mismatchColumns, mapping.description);
    } else if (catalogMatch?.status === 'no_match' || catalogMatch?.status === 'ambiguous') {
      if (matchFileColumn) pushMismatchColumn(mismatchColumns, matchFileColumn);
      if (mapping?.[matchCfg.mappingKey]) pushMismatchColumn(mismatchColumns, mapping[matchCfg.mappingKey]);
      if (matchField === 'name' && mapping?.description) pushMismatchColumn(mismatchColumns, mapping.description);
    }
  } else {
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
  }

  if (sku && duplicateSkuKeys.has(sku.toLowerCase())) {
    pushMismatchColumn(mismatchColumns, mapping.sku);
  }

  if (rowIndex != null && duplicateGroups?.length) {
    for (const col of getImportDuplicateMatchColumns(rowIndex, duplicateGroups, rows, mapping, importDefaults)) {
      pushMismatchColumn(mismatchColumns, col);
    }
  }

  const stockCell = pick('openingStock');
  const stockParsed = parseImportNumeric(stockCell);
  if (stockParsed.invalid) {
    if (mapping?.openingStock) pushMismatchColumn(mismatchColumns, mapping.openingStock);
  }
  if (!isUpdateImport && (stockParsed.value || 0) > 0 && !defaultWarehouseId) {
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

  if (!isUpdateImport) {
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
  }

  const level = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ok';
  return {
    level,
    ok: errors.length === 0,
    errors,
    warnings,
    mismatchColumns,
    summary: errors[0] || warnings[0] || null,
    catalogMatch: catalogMatch || undefined,
  };
}

export const IMPORT_PREVIEW_ROW_STYLE = {
  ok: {},
  warning: { background: '#fffbe6' },
  error: { background: '#fff1f0' },
  added: { background: '#f6ffed' },
  superseded: { background: '#f5f5f5', opacity: 0.85 },
};

export const IMPORT_PREVIEW_CELL_MISMATCH_STYLE = {
  background: '#ffccc7',
  boxShadow: 'inset 0 0 0 1px #ff7875',
};

export async function checkSkuAvailableForImport(sku, excludeItemId = null) {
  const text = String(sku || '').trim();
  if (!text) return { available: false, error: 'SKU is empty' };
  try {
    const params = { sku: text };
    if (excludeItemId) params.excludeItemId = excludeItemId;
    const res = await apiService.get('/items/check-sku', { params });
    return { available: !!res?.data?.available, error: null };
  } catch (e) {
    return { available: false, error: e?.response?.data?.error || 'Could not verify SKU' };
  }
}

function toImportSkuCode(value, len = 3) {
  const parts = String(value || '')
    .trim()
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  const compact = parts.length >= 2
    ? parts.map((part) => part[0].toUpperCase()).join('')
    : parts.join('').toUpperCase();
  return compact.replace(/[^A-Z0-9]+/g, '').slice(0, len);
}

export function normalizeImportOptionalText(value) {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
  return text;
}

export function normalizeImportOptionalNumber(value, { allowZero = true } = {}) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (!allowZero && n === 0) return undefined;
  return n;
}

function normalizeImportTaxRate(value) {
  if (value == null || value === '') return undefined;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Build SKU-rule context from resolved import/update field values (no React form). */
export function buildSkuGenerationContextFromImportValues({
  ruleId,
  name,
  category,
  brandName,
  manufacturerName,
  unitLabel,
  hsnCode,
  mpn,
  barcode,
}) {
  const itemName = name || '';
  const categoryName = category || '';
  const brand = brandName || '';
  const manufacturer = manufacturerName || '';
  const unit = unitLabel || '';
  return {
    ruleId: ruleId || undefined,
    category: categoryName,
    brand,
    manufacturer,
    name: itemName,
    item: itemName,
    unit,
    hsnCode: hsnCode || '',
    mpn: mpn || '',
    barcode: barcode || '',
    brandCode: toImportSkuCode(brand, 3),
    itemCode: toImportSkuCode(itemName, 4),
    categoryCode: toImportSkuCode(categoryName, 3),
    manufacturerCode: toImportSkuCode(manufacturer, 3),
    unitCode: toImportSkuCode(unit, 4),
  };
}

/**
 * Resolve SKU for an import update (mapped file cell or explicit default).
 * Auto-generate when rule is on and SKU has no mapped/default value.
 */
export async function resolveImportUpdateSku({
  row,
  mapping = {},
  importDefaults = {},
  existingSku,
  excludeItemId = null,
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  importSkuRuleId = null,
  skuRules = [],
  skuContext = {},
}) {
  const skuRaw = pickUpdateImportFieldValue(row, mapping, importDefaults, 'sku');
  const skuText = skuRaw !== null ? String(skuRaw).trim() : '';

  if (skuText) {
    if (normalizeImportMatchText(skuText) === normalizeImportMatchText(existingSku || '')) {
      return { sku: existingSku, generated: false, changed: false };
    }
    const check = await checkSkuAvailableForImport(skuText, excludeItemId);
    if (!check.available) {
      return { error: check.error || `SKU "${skuText}" already exists.` };
    }
    return { sku: skuText, generated: false, changed: true };
  }

  if (skuSource === CSV_IMPORT_SKU_AUTO_RULE) {
    const selectedRule = (importSkuRuleId ? skuRules.find((r) => r.id === importSkuRuleId) : null)
      || skuRules.find((r) => !!r.is_default)
      || skuRules[0]
      || null;
    if (!selectedRule) {
      return { error: 'No SKU rule available. Choose Auto-generate SKU or map a SKU column.' };
    }
    try {
      const generated = await skuGeneratorService.generateSku({
        ...skuContext,
        ruleId: selectedRule.id,
      });
      const sku = generated?.sku || '';
      if (!sku) return { error: 'SKU rule did not return a SKU.' };
      return { sku, generated: true, changed: true, ruleName: selectedRule.name };
    } catch (e) {
      return { error: e?.response?.data?.error || e?.message || 'SKU generation failed' };
    }
  }

  return { sku: existingSku, generated: false, changed: false };
}

/**
 * Build sparse API payload for PUT /items/:id — only mapped columns with values are sent.
 * Unmapped fields and import defaults never overwrite existing catalog data.
 */
export async function prepareDirectImportUpdatePayload({
  row,
  rows = [],
  mapping = {},
  importDefaults = {},
  fullItem,
  fieldConfigs = [],
  skuSource = CSV_IMPORT_SKU_FROM_FILE,
  importSkuRuleId = null,
  skuRules = [],
  priceCurrency = 'USD',
  canManageItems = false,
  canManageCategories = false,
  canViewCategories = false,
  categories = [],
  brandOptions = [],
  manufacturerOptions = [],
  unitOptions = [],
  itemGroups = [],
  defaultWarehouseId,
  mergeOptions = null,
}) {
  const errors = [];
  const warnings = [];
  const createdLabels = [];
  const fields = createUpdateImportFieldAccessors(row, mapping, importDefaults);
  const payload = {};

  let openingStock;
  let openingValue;
  if (mergeOptions?.mergeRowIndexes?.length > 1) {
    const merged = buildMergedImportQuantitiesForUpdate(
      mergeOptions.mergeRowIndexes,
      rows,
      mapping,
      importDefaults
    );
    if (merged.anyInvalidStock) {
      warnings.push('Some rows have invalid opening stock; valid quantities were summed.');
    }
    openingStock = merged.openingStock;
    openingValue = merged.openingValue;
  } else {
    if (fields.willUpdate('openingStock')) {
      const stockParsed = parseImportNumeric(fields.getRaw('openingStock'));
      if (!stockParsed.invalid) openingStock = stockParsed.value;
    }
    if (fields.willUpdate('openingValue')) {
      const valueParsed = parseImportNumeric(fields.getRaw('openingValue'));
      if (!valueParsed.invalid) openingValue = valueParsed.value;
    }
  }

  const customResolved = await resolveImportCustomFieldsForUpdate({
    row,
    mapping,
    fieldConfigs,
    itemType: fullItem.type || 'simple',
    canManageItems,
    importDefaults,
  });
  if (customResolved.errors.length) {
    errors.push(...customResolved.errors);
    return { payload: null, errors, warnings, createdLabels };
  }
  createdLabels.push(...customResolved.created);

  let brands = brandOptions;
  let manufacturers = manufacturerOptions;
  let units = unitOptions;
  let groups = itemGroups;

  const brandStr = fields.willUpdate('brand') ? fields.getRaw('brand') : null;
  const mfrStr = fields.willUpdate('manufacturer') ? fields.getRaw('manufacturer') : null;
  const unitRaw = fields.willUpdate('unit') ? fields.getRaw('unit') : null;
  const categoryStr = fields.willUpdate('category') ? fields.getRaw('category') : null;
  const groupName = fields.willUpdate('itemGroupName') ? fields.getRaw('itemGroupName') : null;

  let brandId;
  let manufacturerId;
  let unitId;
  let itemGroupId;

  if (mfrStr) {
    const mfrRes = await ensureImportDropdownOption({
      value: mfrStr,
      options: manufacturers,
      postPath: '/manufacturers',
      getPath: '/manufacturers',
      buildBody: (name) => ({ name }),
    });
    manufacturerId = mfrRes.id;
    manufacturers = mfrRes.options;
    if (mfrRes.created) createdLabels.push(`manufacturer "${mfrRes.createdLabel}"`);
    if (manufacturerId) payload.manufacturer = manufacturerId;
  }
  if (brandStr) {
    const brandRes = await ensureImportDropdownOption({
      value: brandStr,
      options: brands,
      postPath: '/brands',
      getPath: '/brands',
      buildBody: (name) => ({ name }),
    });
    brandId = brandRes.id;
    brands = brandRes.options;
    if (brandRes.created) createdLabels.push(`brand "${brandRes.createdLabel}"`);
    if (brandId) payload.brand = brandId;
  }
  if (unitRaw) {
    const unitRes = await ensureUnitForImport(unitRaw, units);
    unitId = unitRes.id;
    units = unitRes.options;
    if (unitRes.created) createdLabels.push(`unit "${unitRes.createdLabel}"`);
    if (unitId) payload.unit = unitId;
  }
  if (categoryStr) {
    const catRes = await ensureCategoryForImport(
      categoryStr,
      categories,
      canManageCategories,
      canViewCategories
    );
    if (catRes.created) createdLabels.push(`category "${catRes.createdLabel}"`);
    if (catRes.name) payload.category = catRes.name;
  }
  if (groupName) {
    const groupRes = await ensureItemGroupForImport(groupName, groups, canManageItems);
    itemGroupId = groupRes.id;
    groups = groupRes.groups;
    if (groupRes.created) createdLabels.push(`item group "${groupRes.createdLabel}"`);
    if (itemGroupId) {
      payload.itemGroupId = itemGroupId;
      payload.itemGroup = groups.find((g) => g.id === itemGroupId)?.name || null;
    }
  }

  const skuContextName = fields.willUpdate('name')
    ? fields.overlayText('name', fullItem.name)
    : fullItem.name;
  const skuContextCategory = fields.willUpdate('category')
    ? fields.overlayText('category', normalizeImportOptionalText(fullItem.category))
    : normalizeImportOptionalText(fullItem.category);
  const brandRow = brands.find((b) => b.id === (brandId ?? fullItem.brand) || b.name === fullItem.brand);
  const mfrRow = manufacturers.find((m) => m.id === (manufacturerId ?? fullItem.manufacturer) || m.name === fullItem.manufacturer);
  const unitRow = units.find((u) => u.id === (unitId ?? fullItem.unit) || u.name === fullItem.unit);

  const skuContext = buildSkuGenerationContextFromImportValues({
    ruleId: importSkuRuleId,
    name: skuContextName,
    category: skuContextCategory,
    brandName: brandRow?.name || fullItem.brand || '',
    manufacturerName: mfrRow?.name || fullItem.manufacturer || '',
    unitLabel: unitRow?.symbol || unitRow?.name || fullItem.unit || '',
    hsnCode: fields.willUpdate('hsnCode')
      ? fields.overlayText('hsnCode', normalizeImportOptionalText(fullItem.hsn_code))
      : normalizeImportOptionalText(fullItem.hsn_code),
    mpn: fields.willUpdate('mpn')
      ? fields.overlayText('mpn', normalizeImportOptionalText(fullItem.mpn))
      : normalizeImportOptionalText(fullItem.mpn),
    barcode: fields.willUpdate('barcode')
      ? fields.overlayText('barcode', normalizeImportOptionalText(fullItem.barcode))
      : normalizeImportOptionalText(fullItem.barcode),
  });

  const skuResult = await resolveImportUpdateSku({
    row,
    mapping,
    importDefaults,
    existingSku: fullItem.sku,
    excludeItemId: fullItem.id,
    skuSource,
    importSkuRuleId,
    skuRules,
    skuContext,
  });
  if (skuResult.error) {
    errors.push(skuResult.error);
    return { payload: null, errors, warnings, createdLabels };
  }
  if (skuResult.changed) {
    payload.sku = skuResult.sku;
    if (skuResult.generated) {
      warnings.push(`Auto-generated SKU: ${skuResult.sku}${skuResult.ruleName ? ` (${skuResult.ruleName})` : ''}`);
    }
  }

  if (fields.willUpdate('name')) payload.name = fields.overlayText('name', fullItem.name);

  let importDescription;
  const noteText = String(mergeOptions?.importNote || '').trim();
  if (mergeOptions?.mergeRowIndexes?.length > 1) {
    importDescription = buildMergedImportDescription({
      primaryRow: row,
      rowIndexes: mergeOptions.mergeRowIndexes,
      rows,
      mapping,
      importDefaults: {},
      userNote: noteText,
      mappedOnly: true,
    });
    if (importDescription) payload.description = importDescription;
  } else {
    if (fields.willUpdate('description')) {
      importDescription = fields.overlayText('description', normalizeImportOptionalText(fullItem.description));
      if (noteText) {
        importDescription = [importDescription, `Import note: ${noteText}`].filter(Boolean).join('\n\n');
      }
      if (importDescription !== undefined) payload.description = importDescription;
    } else if (noteText) {
      const base = normalizeImportOptionalText(fullItem.description);
      payload.description = [base, `Import note: ${noteText}`].filter(Boolean).join('\n\n');
    }
  }

  if (fields.willUpdate('barcode')) {
    payload.barcode = fields.overlayText('barcode', normalizeImportOptionalText(fullItem.barcode));
  }
  if (fields.willUpdate('hsnCode')) {
    payload.hsnCode = fields.overlayText('hsnCode', normalizeImportOptionalText(fullItem.hsn_code));
  }
  if (fields.willUpdate('upc')) payload.upc = fields.overlayText('upc', normalizeImportOptionalText(fullItem.upc));
  if (fields.willUpdate('ean')) payload.ean = fields.overlayText('ean', normalizeImportOptionalText(fullItem.ean));
  if (fields.willUpdate('isbn')) payload.isbn = fields.overlayText('isbn', normalizeImportOptionalText(fullItem.isbn));
  if (fields.willUpdate('mpn')) payload.mpn = fields.overlayText('mpn', normalizeImportOptionalText(fullItem.mpn));
  if (fields.willUpdate('supplierCode')) {
    payload.supplierCode = fields.overlayText('supplierCode', normalizeImportOptionalText(fullItem.supplier_code)) || null;
  }
  if (fields.willUpdate('batchNumber')) {
    payload.batchNumber = fields.overlayText('batchNumber', normalizeImportOptionalText(fullItem.batch_number))?.toUpperCase() || null;
  }

  const numericFields = ['minStockLevel', 'maxStockLevel', 'weight'];
  for (const key of numericFields) {
    if (!fields.willUpdate(key)) continue;
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    const existing = normalizeImportOptionalNumber(fullItem[snakeKey], { allowZero: key !== 'weight' });
    const val = fields.overlayNumber(key, existing, { allowZero: key !== 'weight' });
    if (val !== undefined) payload[key] = val;
  }

  if (fields.willUpdate('costPrice')) {
    const existing = normalizeImportOptionalNumber(convertPrice(fullItem.cost_price, 'USD', priceCurrency), { allowZero: true });
    const val = fields.overlayNumber('costPrice', existing, { allowZero: true });
    if (val != null) payload.costPrice = convertPrice(val, priceCurrency, 'USD');
  }
  if (fields.willUpdate('sellingPrice')) {
    const existing = normalizeImportOptionalNumber(convertPrice(fullItem.selling_price, 'USD', priceCurrency), { allowZero: false });
    const val = fields.overlayNumber('sellingPrice', existing, { allowZero: false });
    if (val != null) payload.sellingPrice = convertPrice(val, priceCurrency, 'USD');
  }
  if (fields.willUpdate('mrp')) {
    const existing = normalizeImportOptionalNumber(convertPrice(fullItem.mrp, 'USD', priceCurrency), { allowZero: false });
    const val = fields.overlayNumber('mrp', existing, { allowZero: false });
    if (val != null) payload.mrp = convertPrice(val, priceCurrency, 'USD');
  }
  if (fields.willUpdate('taxRate')) {
    const val = normalizeImportTaxRate(fields.getRaw('taxRate'));
    if (val !== undefined) payload.taxRate = val;
  }

  const dimKeys = [
    { key: 'dimLength', dim: 'length' },
    { key: 'dimWidth', dim: 'width' },
    { key: 'dimHeight', dim: 'height' },
  ];
  const dimUpdate = {};
  let hasDimUpdate = false;
  for (const { key, dim } of dimKeys) {
    if (!fields.willUpdate(key)) continue;
    const parsed = parseImportNumeric(fields.getRaw(key), { emptyAsZero: false });
    if (!parsed.invalid) {
      dimUpdate[dim] = normalizeImportOptionalNumber(parsed.value, { allowZero: false }) || 0;
      hasDimUpdate = true;
    }
  }
  if (hasDimUpdate) {
    payload.dimensions = {
      length: dimUpdate.length ?? fullItem.dimensions?.length ?? 0,
      width: dimUpdate.width ?? fullItem.dimensions?.width ?? 0,
      height: dimUpdate.height ?? fullItem.dimensions?.height ?? 0,
    };
  }

  if (Object.keys(customResolved.customFields).length > 0) {
    payload.customFields = { ...(fullItem?.custom_fields || {}), ...customResolved.customFields };
  }

  if (openingStock !== undefined) {
    payload.openingStock = normalizeImportOptionalNumber(openingStock) || 0;
    let warehouseId = fullItem.warehouse_ids?.[0] || null;
    if (!warehouseId && fullItem.default_bin_id) {
      try {
        const binResponse = await apiService.get(`/warehouse-locations/bins/${fullItem.default_bin_id}`);
        if (binResponse.success) warehouseId = binResponse.data?.warehouse_id || null;
      } catch { /* ignore */ }
    }
    if (!warehouseId && (payload.openingStock || 0) > 0) {
      warehouseId = defaultWarehouseId || null;
    }
    if ((payload.openingStock || 0) > 0 && !warehouseId) {
      errors.push('Select a default warehouse in the import dialog (required when opening stock is mapped).');
      return { payload: null, errors, warnings, createdLabels };
    }
    if (warehouseId) payload.warehouseId = warehouseId;
  }
  if (openingValue !== undefined) {
    payload.openingValue = normalizeImportOptionalNumber(openingValue, { allowZero: false }) || 0;
  }

  if (Object.keys(payload).length === 0) {
    errors.push('Nothing to update on this row. Add a field mapping or default, or enable Auto-generate SKU.');
    return { payload: null, errors, warnings, createdLabels };
  }

  return {
    payload,
    errors,
    warnings,
    createdLabels,
    masterData: { brands, manufacturers, units, groups, categories },
  };
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

/** Update import: only mapped custom-field columns with non-empty cells are applied. */
export async function resolveImportCustomFieldsForUpdate({
  row,
  mapping,
  fieldConfigs = [],
  itemType,
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
    let raw = pickUpdateImportFieldValue(row, mapping, importDefaults, cfKey);
    if (raw === null || raw === '') continue;

    const fieldType = String(c.field_type || c.fieldType || 'text').toLowerCase();
    let value = coerceImportedCustomValue(raw, fieldType);
    if (value === undefined) {
      errors.push(`Custom field "${label}": invalid value "${String(raw).trim()}"`);
      continue;
    }

    if (fieldType === 'select') {
      let options = parseFieldConfigOptions(c.options);
      const insensitive = options.find((o) => o.toLowerCase() === String(value).toLowerCase());
      if (insensitive) {
        value = insensitive;
      } else if (options.length > 0) {
        if (canManageItems) {
          const nextOptions = [...options, String(value)];
          try {
            await apiService.put(`/items/field-config/${itemType}/${fn}/options`, { options: nextOptions });
            created.push(`option "${value}" on ${label}`);
          } catch {
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

export async function createImportBatchesForItem(itemId, batchLines, warehouseId) {
  const created = [];
  const errors = [];
  for (const line of batchLines || []) {
    try {
      await apiService.createBatch({
        itemId,
        warehouseId,
        batchNumber: line.batchNumber,
        quantityReceived: line.quantity,
        unitCost: line.unitCost || 0,
        manufactureDate: line.manufactureDate || undefined,
        expiryDate: line.expiryDate || undefined,
      });
      created.push(line.batchNumber);
    } catch (e) {
      errors.push(`${line.batchNumber}: ${e?.response?.data?.error || e?.message || 'Failed'}`);
    }
  }
  return { created, errors };
}
