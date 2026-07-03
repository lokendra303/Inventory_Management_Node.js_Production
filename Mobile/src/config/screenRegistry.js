/**
 * Generic list screens — endpoint config keyed by React Navigation screen name.
 * stack: which navigator registers this screen.
 */
export const LIST_SCREEN_REGISTRY = {
  SalesInvoices: {
    stack: 'more',
    title: 'Sales invoices',
    endpoint: '/sales-invoices',
    params: { limit: 200 },
    titleKeys: ['invoice_number', 'invoiceNumber'],
    subtitleKeys: ['customer_name', 'customerName', 'party_name'],
    metaKeys: ['status', 'total_amount', 'totalAmount', 'balance_due'],
    icon: 'file-document-outline',
    dataPaths: ['data.invoices', 'data', 'invoices'],
  },
  PurchaseInvoices: {
    stack: 'more',
    title: 'Purchase invoices',
    endpoint: '/purchase-invoices',
    params: { limit: 200 },
    titleKeys: ['invoice_number', 'invoiceNumber'],
    subtitleKeys: ['vendor_name', 'vendorName', 'party_name'],
    metaKeys: ['status', 'total_amount', 'totalAmount', 'balance_due'],
    icon: 'file-document-outline',
    dataPaths: ['data.invoices', 'data', 'invoices'],
  },
  ThirdPartyInvoices: {
    stack: 'more',
    title: 'Third-party invoices',
    endpoint: '/third-party-invoices',
    params: { limit: 200 },
    titleKeys: ['invoice_number', 'invoiceNumber'],
    subtitleKeys: ['party_name', 'customer_name'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'file-swap-outline',
    dataPaths: ['data.invoices', 'data', 'invoices'],
  },
  CreditNotes: {
    stack: 'more',
    title: 'Credit notes',
    endpoint: '/sales-invoices',
    params: { type: 'credit_note', limit: 200 },
    titleKeys: ['invoice_number', 'invoiceNumber'],
    subtitleKeys: ['customer_name', 'customerName'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'note-minus-outline',
    dataPaths: ['data.invoices', 'data', 'invoices'],
  },
  VendorCredits: {
    stack: 'more',
    title: 'Vendor credits',
    endpoint: '/purchase-invoices',
    params: { type: 'credit_note', limit: 200 },
    titleKeys: ['invoice_number', 'invoiceNumber'],
    subtitleKeys: ['vendor_name', 'vendorName'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'note-minus-outline',
    dataPaths: ['data.invoices', 'data', 'invoices'],
  },
  SalesReturns: {
    stack: 'more',
    title: 'Sales returns',
    endpoint: '/sales-orders',
    params: { status: 'returned', limit: 200 },
    titleKeys: ['order_number', 'so_number', 'number'],
    subtitleKeys: ['customer_name', 'customerName'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'keyboard-return',
    dataPaths: ['data.orders', 'data', 'orders'],
  },
  PurchaseReturns: {
    stack: 'more',
    title: 'Purchase returns',
    endpoint: '/purchase-returns',
    params: { limit: 200 },
    titleKeys: ['return_number', 'number', 'id'],
    subtitleKeys: ['vendor_name', 'vendorName'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'keyboard-return',
    dataPaths: ['data.returns', 'data', 'returns'],
  },
  PaymentsReceived: {
    stack: 'more',
    title: 'Payments received',
    endpoint: '/accounting/payments',
    params: { type: 'receivable', limit: 200 },
    titleKeys: ['reference', 'payment_number', 'invoice_number'],
    subtitleKeys: ['party_name', 'customer_name', 'description'],
    metaKeys: ['amount', 'payment_method', 'method', 'status'],
    icon: 'cash-plus',
    dataPaths: ['data.payments', 'data', 'payments'],
  },
  PaymentsMade: {
    stack: 'more',
    title: 'Payments made',
    endpoint: '/accounting/payments',
    params: { type: 'payable', limit: 200 },
    titleKeys: ['reference', 'payment_number', 'invoice_number'],
    subtitleKeys: ['party_name', 'vendor_name', 'description'],
    metaKeys: ['amount', 'payment_method', 'method', 'status'],
    icon: 'cash-minus',
    dataPaths: ['data.payments', 'data', 'payments'],
  },
  PurchaseBills: {
    stack: 'more',
    title: 'Bills',
    endpoint: '/purchase-invoices',
    params: { limit: 200 },
    titleKeys: ['invoice_number', 'invoiceNumber'],
    subtitleKeys: ['vendor_name', 'vendorName'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'receipt',
    dataPaths: ['data.invoices', 'data', 'invoices'],
  },
  PurchaseReceives: {
    stack: 'more',
    title: 'Purchase receives',
    endpoint: '/purchase-orders',
    params: { status: 'received', limit: 200 },
    titleKeys: ['po_number', 'order_number', 'number'],
    subtitleKeys: ['vendor_name', 'vendorName'],
    metaKeys: ['status', 'total_amount', 'totalAmount'],
    icon: 'package-down',
    dataPaths: ['data.orders', 'data', 'orders'],
  },
  InvoicePayments: {
    stack: 'more',
    title: 'Invoice payments',
    endpoint: '/accounting/payments',
    params: { limit: 300 },
    titleKeys: ['reference', 'payment_number', 'invoice_number'],
    subtitleKeys: ['party_name', 'description'],
    metaKeys: ['amount', 'payment_method', 'method', 'status'],
    icon: 'cash-multiple',
    dataPaths: ['data.payments', 'data', 'payments'],
  },
  ReorderLevels: {
    stack: 'inventory',
    title: 'Reorder levels',
    endpoint: '/reorder-levels',
    params: { limit: 200 },
    titleKeys: ['item_name', 'itemName', 'sku'],
    subtitleKeys: ['warehouse_name', 'warehouseName'],
    metaKeys: ['reorder_level', 'reorderLevel', 'current_stock', 'currentStock'],
    icon: 'bell-ring-outline',
    dataPaths: ['data.levels', 'data', 'levels'],
  },
  Shipments: {
    stack: 'inventory',
    title: 'Shipments',
    mergeRequests: [
      { endpoint: '/sales-orders', params: { status: 'confirmed', limit: 100 } },
      { endpoint: '/sales-orders', params: { status: 'partially_shipped', limit: 100 } },
      { endpoint: '/sales-orders', params: { status: 'shipped', limit: 100 } },
    ],
    titleKeys: ['order_number', 'so_number', 'number'],
    subtitleKeys: ['customer_name', 'customerName'],
    metaKeys: ['status', 'shipped_quantity', 'total_quantity'],
    icon: 'truck-fast-outline',
    dataPaths: ['data.orders', 'data', 'orders'],
  },
  ProductionBom: {
    stack: 'more',
    title: 'BOM items',
    endpoint: '/production/bom-items',
    params: { status: 'all', limit: 200 },
    titleKeys: ['name', 'item_name', 'sku'],
    subtitleKeys: ['status', 'category_name'],
    metaKeys: ['quantity', 'unit'],
    icon: 'hammer-screwdriver',
    dataPaths: ['data.items', 'data.bom_items', 'data', 'items'],
  },
  BatchRules: {
    stack: 'more',
    title: 'Batch coding rules',
    endpoint: '/batch-rules',
    params: { limit: 200 },
    titleKeys: ['name', 'rule_name', 'pattern'],
    subtitleKeys: ['context', 'description'],
    metaKeys: ['is_active', 'status'],
    icon: 'barcode',
    dataPaths: ['data.rules', 'data', 'rules'],
  },
  ItemTrash: {
    stack: 'items',
    title: 'Item trash',
    endpoint: '/items',
    params: { status: 'trashed', limit: 200 },
    titleKeys: ['name', 'item_name', 'sku'],
    subtitleKeys: ['category_name', 'brand_name'],
    metaKeys: ['deleted_at', 'status'],
    icon: 'delete-restore',
    dataPaths: ['data.items', 'data', 'items'],
  },
  Users: {
    stack: 'more',
    title: 'Users',
    endpoint: '/users',
    params: { limit: 200 },
    titleKeys: ['name', 'full_name', 'username', 'email'],
    subtitleKeys: ['email', 'role'],
    metaKeys: ['status', 'is_active'],
    icon: 'account-multiple-outline',
    dataPaths: ['data.users', 'data', 'users'],
  },
  Roles: {
    stack: 'more',
    title: 'Roles',
    endpoint: '/roles',
    params: { limit: 200 },
    titleKeys: ['name', 'role', 'label'],
    subtitleKeys: ['description'],
    metaKeys: ['user_count', 'permissions_count'],
    icon: 'shield-account-outline',
    dataPaths: ['data.roles', 'data', 'roles'],
  },
  TaxRates: {
    stack: 'more',
    title: 'Tax rates',
    endpoint: '/tax/rates',
    params: { limit: 200 },
    titleKeys: ['name', 'rate_name'],
    subtitleKeys: ['tax_type', 'type'],
    metaKeys: ['rate', 'percentage'],
    icon: 'percent-outline',
    dataPaths: ['data.rates', 'data', 'rates'],
  },
  PriceLists: {
    stack: 'more',
    title: 'Price lists',
    endpoint: '/price-lists',
    params: { limit: 200 },
    titleKeys: ['name', 'list_name'],
    subtitleKeys: ['currency', 'description'],
    metaKeys: ['status', 'is_default'],
    icon: 'tag-multiple-outline',
    dataPaths: ['data.lists', 'data', 'price_lists', 'priceLists'],
  },
  Workflows: {
    stack: 'more',
    title: 'Workflows',
    endpoint: '/workflows',
    params: { limit: 200 },
    titleKeys: ['name', 'workflow_name'],
    subtitleKeys: ['trigger', 'description'],
    metaKeys: ['status', 'is_active'],
    icon: 'lightning-bolt-outline',
    dataPaths: ['data.workflows', 'data', 'workflows'],
  },
  ExchangeRates: {
    stack: 'more',
    title: 'Exchange rates',
    endpoint: '/settings/exchange-rates',
    titleKeys: ['from_currency', 'fromCurrency', 'currency_pair'],
    subtitleKeys: ['to_currency', 'toCurrency'],
    metaKeys: ['rate', 'updated_at'],
    icon: 'swap-horizontal',
    dataPaths: ['data.rates', 'data', 'rates'],
  },
  AllSettings: {
    stack: 'more',
    title: 'All settings',
    endpoint: '/settings',
    titleKeys: ['key', 'name', 'label', 'setting_key'],
    subtitleKeys: ['category', 'group', 'description'],
    metaKeys: ['value', 'setting_value'],
    icon: 'tune-vertical',
    dataPaths: ['data.settings', 'data', 'settings'],
  },
};

export function extractListRows(response, dataPaths = ['data']) {
  if (!response) return [];
  const paths = dataPaths?.length ? dataPaths : ['data'];
  for (const path of paths) {
    let cur = response;
    for (const part of String(path).split('.')) {
      cur = cur?.[part];
    }
    if (Array.isArray(cur)) return cur;
  }
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export function pickField(row, keys = []) {
  if (!row || !keys?.length) return null;
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && val !== '') return String(val);
  }
  return null;
}

export function screensForStack(stackName) {
  return Object.entries(LIST_SCREEN_REGISTRY)
    .filter(([, cfg]) => cfg.stack === stackName)
    .map(([name, cfg]) => ({ name, ...cfg }));
}
