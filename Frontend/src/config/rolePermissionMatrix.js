/**
 * Role permission matrix: grouped rows with Full / View / Create / Edit / Delete / Approve columns.
 * Maps to flat permission keys stored in the API (object of key -> true).
 *
 * - `cells.full`: keys selected when "Full" is on for the row (typically union of row scope).
 * - `cells.view` | `create` | `edit` | `delete` | `approve`: arrays of keys toggled by that column;
 *   use the same key in multiple columns when the backend has a single flag (e.g. *_management).
 * - `moreKeys`: extra keys shown under "More permissions" for this row.
 */

export const PERMISSION_MATRIX_SECTIONS = [
  {
    title: 'Administration',
    rows: [
      {
        id: 'sys_all',
        label: 'Full system access',
        /** Only “Full” applies: one backend flag `all` grants every module. Other columns are not used (—). */
        cells: {
          full: ['all'],
          view: null,
          create: null,
          edit: null,
          delete: null,
          approve: null,
        },
        moreKeys: [],
      },
      {
        id: 'users_roles',
        label: 'Users & roles',
        cells: {
          full: ['user_management', 'api_key_management'],
          view: ['user_management'],
          create: ['user_management'],
          edit: ['user_management'],
          delete: ['user_management'],
          approve: [],
        },
        moreKeys: ['api_key_management'],
      },
    ],
  },
  {
    title: 'Items & catalog',
    rows: [
      {
        id: 'items',
        label: 'Items',
        cells: {
          full: ['item_view', 'item_management'],
          view: ['item_view'],
          create: ['item_management'],
          edit: ['item_management'],
          delete: ['item_management'],
          approve: [],
        },
        moreKeys: [],
      },
      {
        id: 'categories',
        label: 'Categories',
        cells: {
          full: ['category_view', 'category_management'],
          view: ['category_view'],
          create: ['category_management'],
          edit: ['category_management'],
          delete: ['category_management'],
          approve: [],
        },
        moreKeys: [],
      },
    ],
  },
  {
    title: 'Inventory',
    rows: [
      {
        id: 'inv_overview',
        label: 'Inventory overview & controls',
        cells: {
          full: ['inventory_view', 'inventory_management'],
          view: ['inventory_view'],
          create: ['inventory_management'],
          edit: ['inventory_management'],
          delete: ['inventory_management'],
          approve: [],
        },
        moreKeys: [],
      },
      {
        id: 'inv_receive',
        label: 'Receive / putaway',
        cells: {
          full: ['inventory_receive'],
          view: ['inventory_receive'],
          create: ['inventory_receive'],
          edit: ['inventory_receive'],
          delete: ['inventory_receive'],
          approve: ['inventory_receive'],
        },
        moreKeys: [],
      },
      {
        id: 'inv_reserve',
        label: 'Reserve stock',
        cells: {
          full: ['inventory_reserve'],
          view: ['inventory_reserve'],
          create: ['inventory_reserve'],
          edit: ['inventory_reserve'],
          delete: ['inventory_reserve'],
          approve: ['inventory_reserve'],
        },
        moreKeys: [],
      },
      {
        id: 'inv_ship',
        label: 'Shipments',
        cells: {
          full: ['inventory_ship'],
          view: ['inventory_ship'],
          create: ['inventory_ship'],
          edit: ['inventory_ship'],
          delete: ['inventory_ship'],
          approve: ['inventory_ship'],
        },
        moreKeys: [],
      },
      {
        id: 'inv_adjust',
        label: 'Inventory adjustments',
        cells: {
          full: ['inventory_adjust'],
          view: ['inventory_adjust'],
          create: ['inventory_adjust'],
          edit: ['inventory_adjust'],
          delete: ['inventory_adjust'],
          approve: ['inventory_adjust'],
        },
        moreKeys: [],
      },
      {
        id: 'inv_transfer',
        label: 'Transfer orders',
        cells: {
          full: ['inventory_transfer'],
          view: ['inventory_transfer'],
          create: ['inventory_transfer'],
          edit: ['inventory_transfer'],
          delete: ['inventory_transfer'],
          approve: ['inventory_transfer'],
        },
        moreKeys: [],
      },
    ],
  },
  {
    title: 'Warehouses',
    rows: [
      {
        id: 'wh',
        label: 'Warehouses',
        cells: {
          full: ['warehouse_view', 'warehouse_management'],
          view: ['warehouse_view'],
          create: ['warehouse_management'],
          edit: ['warehouse_management'],
          delete: ['warehouse_management'],
          approve: [],
        },
        moreKeys: [],
      },
      {
        id: 'wh_types',
        label: 'Warehouse types',
        cells: {
          full: ['warehouse_type_view', 'warehouse_type_management'],
          view: ['warehouse_type_view'],
          create: ['warehouse_type_management'],
          edit: ['warehouse_type_management'],
          delete: ['warehouse_type_management'],
          approve: [],
        },
        moreKeys: [],
      },
    ],
  },
  {
    title: 'Purchases & vendors',
    rows: [
      {
        id: 'po',
        label: 'Purchase orders',
        cells: {
          full: ['purchase_view', 'purchase_management'],
          view: ['purchase_view'],
          create: ['purchase_management'],
          edit: ['purchase_management'],
          delete: ['purchase_management'],
          approve: [],
        },
        moreKeys: [],
      },
      {
        id: 'vendors',
        label: 'Vendors',
        cells: {
          full: ['vendor_view', 'vendor_management'],
          view: ['vendor_view'],
          create: ['vendor_management'],
          edit: ['vendor_management'],
          delete: ['vendor_management'],
          approve: [],
        },
        moreKeys: [],
      },
    ],
  },
  {
    title: 'Sales & customers',
    rows: [
      {
        id: 'so',
        label: 'Sales orders',
        cells: {
          full: ['sales_view', 'sales_management'],
          view: ['sales_view'],
          create: ['sales_management'],
          edit: ['sales_management'],
          delete: ['sales_management'],
          approve: [],
        },
        moreKeys: [],
      },
      {
        id: 'customers',
        label: 'Customers',
        cells: {
          full: ['customer_view', 'customer_management'],
          view: ['customer_view'],
          create: ['customer_management'],
          edit: ['customer_management'],
          delete: ['customer_management'],
          approve: [],
        },
        moreKeys: [],
      },
    ],
  },
  {
    title: 'Invoices & finance',
    rows: [
      {
        id: 'invoices',
        label: 'Invoices',
        cells: {
          full: ['invoice_view', 'invoice_management'],
          view: ['invoice_view'],
          create: ['invoice_management'],
          edit: ['invoice_management'],
          delete: ['invoice_management'],
          approve: [],
        },
        moreKeys: [],
      },
    ],
  },
  {
    title: 'Compliance',
    rows: [
      {
        id: 'audit',
        label: 'Audit trail',
        cells: {
          full: ['audit_view'],
          view: ['audit_view'],
          create: ['audit_view'],
          edit: ['audit_view'],
          delete: ['audit_view'],
          approve: [],
        },
        moreKeys: [],
      },
    ],
  },
];

const COLUMN_KEYS = ['full', 'view', 'create', 'edit', 'delete', 'approve'];

/** All permission keys referenced by the matrix (unique). */
export function collectMatrixPermissionKeys() {
  const set = new Set();
  PERMISSION_MATRIX_SECTIONS.forEach((sec) => {
    sec.rows.forEach((row) => {
      COLUMN_KEYS.forEach((col) => {
        const arr = row.cells[col];
        if (Array.isArray(arr)) arr.forEach((k) => set.add(k));
      });
      (row.moreKeys || []).forEach((k) => set.add(k));
    });
  });
  return Array.from(set);
}

/** All keys in the matrix except the global `all` flag (for “Select all modules”). */
export function allExplicitMatrixKeys() {
  return collectMatrixPermissionKeys().filter((k) => k !== 'all');
}

function unionKeys(row) {
  const u = new Set();
  COLUMN_KEYS.forEach((col) => {
    const arr = row.cells[col];
    if (Array.isArray(arr)) arr.forEach((k) => u.add(k));
  });
  (row.moreKeys || []).forEach((k) => u.add(k));
  return u;
}

/** Keys for this row only (for clear-row / full toggle). */
export function rowKeySet(row) {
  return unionKeys(row);
}

export function isKeySelected(selectedSet, key) {
  if (selectedSet.has('all')) return true;
  return selectedSet.has(key);
}

/** Checkbox checked if every key in `keys` is selected (empty -> unchecked). */
export function cellChecked(selectedSet, keys) {
  if (!keys || keys.length === 0) return false;
  return keys.every((k) => isKeySelected(selectedSet, k));
}

export function cellIndeterminate(selectedSet, keys) {
  if (!keys || keys.length === 0) return false;
  const any = keys.some((k) => isKeySelected(selectedSet, k));
  const all = keys.every((k) => isKeySelected(selectedSet, k));
  return any && !all;
}

/** True when the special `all` flag is on, or every matrix permission (except `all`) is on — same effective access. */
export function isEffectiveSysAllSelected(selectedList) {
  const set = new Set((selectedList || []).filter(Boolean));
  if (set.has('all')) return true;
  const explicit = allExplicitMatrixKeys();
  if (explicit.length === 0) return false;
  return explicit.every((k) => set.has(k));
}

/** Partial module selection: not full system, but not empty. */
export function isSysAllFullIndeterminate(selectedList) {
  const set = new Set((selectedList || []).filter(Boolean));
  if (set.has('all')) return false;
  const explicit = allExplicitMatrixKeys();
  const n = explicit.filter((k) => set.has(k)).length;
  return n > 0 && n < explicit.length;
}

/** When leaving `all`, start from every explicit matrix key plus any custom keys not in the matrix. */
function expandFromAllPreserveCustom(currentList) {
  const matrixExplicit = allExplicitMatrixKeys();
  const matrixSet = new Set(matrixExplicit);
  const custom = (currentList || []).filter((k) => k && k !== 'all' && !matrixSet.has(k));
  const set = new Set(matrixExplicit);
  custom.forEach((k) => set.add(k));
  return set;
}

/**
 * Toggle a column cell. `keys` is the permission keys bound to that cell.
 * If the role had `all`, expand to explicit keys first then apply the toggle.
 */
export function toggleCellKeys(currentList, keys, checked) {
  if (!keys || keys.length === 0) return [...(currentList || [])];
  let set = new Set((currentList || []).filter(Boolean));
  if (set.has('all')) {
    set = expandFromAllPreserveCustom(currentList);
  }
  if (checked) {
    keys.forEach((k) => set.add(k));
  } else {
    keys.forEach((k) => set.delete(k));
  }
  return Array.from(set);
}

/** Full row on/off: add or remove all keys belonging to the row. */
export function toggleRowFull(currentList, row, checked) {
  if (row.id === 'sys_all') {
    if (checked) return ['all'];
    const set = new Set((currentList || []).filter(Boolean));
    set.delete('all');
    const explicit = allExplicitMatrixKeys();
    // Had omnipotent via explicit toggles only — clear entire matrix slice (same as revoking “full system”).
    if (explicit.length > 0 && explicit.every((k) => set.has(k))) {
      explicit.forEach((k) => set.delete(k));
      return Array.from(set);
    }
    return Array.from(set);
  }
  const rowKeys = rowKeySet(row);
  let set = new Set((currentList || []).filter(Boolean));
  if (set.has('all')) {
    set = expandFromAllPreserveCustom(currentList);
  }
  if (checked) {
    rowKeys.forEach((k) => set.add(k));
  } else {
    rowKeys.forEach((k) => set.delete(k));
  }
  return Array.from(set);
}

/** Select every matrix permission; drop `all`; keep custom keys not in the matrix. */
export function selectAllMatrixPermissions(currentList) {
  const matrixExplicit = allExplicitMatrixKeys();
  const mset = new Set(matrixExplicit);
  const kept = (currentList || []).filter((k) => k && k !== 'all' && !mset.has(k));
  return [...matrixExplicit, ...kept];
}

export { COLUMN_KEYS };
