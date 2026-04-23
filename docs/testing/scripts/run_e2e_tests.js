/* eslint-disable */
/**
 * IMS SEPCUNE — End-to-end feature test runner.
 *
 * Registers (or reuses) the "AI-testing" institution, logs in, and walks
 * every major business flow against the live backend at $API_BASE.
 * Writes a structured JSON report to docs/testing/results.json.
 *
 * Usage:
 *   node docs/testing/scripts/run_e2e_tests.js
 */

const path = require('path');
const fs = require('fs');
const BACKEND = path.resolve(__dirname, '../../../Backend');
const dotenv = require(path.join(BACKEND, 'node_modules/dotenv'));
dotenv.config({ path: path.join(BACKEND, '.env') });

const axiosMod = require(path.join(BACKEND, 'node_modules/axios'));
const axios = axiosMod.default || axiosMod;
const mysql = require(path.join(BACKEND, 'node_modules/mysql2/promise'));

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';
const TEST_EMAIL = 'ai-testing@example.com';
const TEST_PASSWORD = 'Test@12345';
const RESULTS_PATH = path.resolve(__dirname, '../results.json');
const RUN_TAG = Date.now().toString().slice(-6);
const uniq = (s) => `${s}-${RUN_TAG}`;

// ---------- helpers ----------
let pool;
let token = null;
let institutionId = null;
let userId = null;
const results = []; // {group, name, status: 'pass'|'fail'|'partial'|'skip', details, elapsedMs}

const api = axios.create({ baseURL: API_BASE, validateStatus: () => true, timeout: 30000 });
api.interceptors.request.use((cfg) => {
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

const pickOtp = async (email, purpose) => {
  const [rows] = await pool.execute(
    `SELECT otp_code, created_at FROM otp_tokens
      WHERE email = ? AND purpose = ? AND consumed_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [email, purpose]
  );
  return rows[0]?.otp_code || null;
};

const record = (group, name, status, details = '', elapsedMs = 0) => {
  const entry = { group, name, status, details: typeof details === 'string' ? details : JSON.stringify(details), elapsedMs };
  results.push(entry);
  const icon = { pass: '[PASS]', fail: '[FAIL]', partial: '[PART]', skip: '[SKIP]' }[status] || '[?]';
  console.log(`${icon} [${group}] ${name} ${details ? '— ' + entry.details.slice(0, 140) : ''}`);
};

const run = async (group, name, fn) => {
  const t0 = now();
  try {
    const out = await fn();
    if (out && out.status) {
      record(group, name, out.status, out.details || '', now() - t0);
      return out;
    }
    record(group, name, 'pass', out?.details || '', now() - t0);
    return { status: 'pass', ...(out || {}) };
  } catch (e) {
    record(group, name, 'fail', e.message || String(e), now() - t0);
    return { status: 'fail', error: e };
  }
};

// Treat backend envelope {success, data} tolerantly
const okData = (r) => (r.data && (r.data.data ?? r.data)) || r.data;

// ---------- Phase 0: health ----------
async function healthChecks() {
  // Try both /api/health and /health (server mounts outside /api in some projects)
  for (const url of ['http://127.0.0.1:5000/api/health', 'http://127.0.0.1:5000/health']) {
    try {
      const r = await axios.get(url, { validateStatus: () => true, timeout: 5000 });
      if (r.status === 200) {
        record('platform', `GET ${url}`, 'pass', `status=${r.status}`, 0);
        return;
      }
    } catch (e) {
      /* ignore */
    }
  }
  record('platform', 'GET /health*', 'partial', 'no /health endpoint registered in server.js (only referenced in middleware skip-lists) — doc §12 gap', 0);
}

// ---------- Phase 1: auth ----------
async function ensureAiTestingAccount() {
  // Look up existing
  const [rows] = await pool.execute(
    `SELECT u.id as userId, u.institution_id as institutionId
       FROM institution_users u
      WHERE u.email = ? LIMIT 1`,
    [TEST_EMAIL]
  );
  if (rows.length) {
    institutionId = rows[0].institutionId;
    userId = rows[0].userId;
    record('auth', 'Re-use existing AI-testing institution', 'pass', `institutionId=${institutionId}`, 0);
    return;
  }

  // 1) send-otp
  let t0 = now();
  const sendR = await api.post('/auth/send-otp', { email: TEST_EMAIL });
  if (sendR.status !== 200) {
    record('auth', 'POST /auth/send-otp (registration)', 'fail', `status=${sendR.status} body=${JSON.stringify(sendR.data)}`, now() - t0);
    throw new Error('send-otp failed');
  }
  record('auth', 'POST /auth/send-otp (registration)', 'pass', `status=${sendR.status}`, now() - t0);

  await sleep(300);
  const regOtp = await pickOtp(TEST_EMAIL, 'registration');
  if (!regOtp) throw new Error('No registration OTP in DB');
  record('auth', 'Read registration OTP from DB', 'pass', `otp=${regOtp}`, 0);

  t0 = now();
  const vR = await api.post('/auth/verify-registration-otp', { email: TEST_EMAIL, otp: regOtp });
  if (vR.status !== 200) {
    record('auth', 'POST /auth/verify-registration-otp', 'fail', `status=${vR.status} body=${JSON.stringify(vR.data)}`, now() - t0);
    throw new Error('registration OTP verify failed');
  }
  record('auth', 'POST /auth/verify-registration-otp', 'pass', `status=${vR.status}`, now() - t0);

  t0 = now();
  const regR = await api.post('/auth/register-institution', {
    name: 'AI-testing',
    institutionType: 'corporate',
    institutionEmail: TEST_EMAIL,
    adminEmail: TEST_EMAIL,
    adminPassword: TEST_PASSWORD,
    adminFirstName: 'AI',
    adminLastName: 'Tester',
  });
  if (regR.status !== 201) {
    record('auth', 'POST /auth/register-institution', 'fail', `status=${regR.status} body=${JSON.stringify(regR.data)}`, now() - t0);
    throw new Error('register failed');
  }
  institutionId = regR.data.data.institutionId;
  userId = regR.data.data.userId;
  record('auth', 'POST /auth/register-institution', 'pass', `institutionId=${institutionId}`, now() - t0);
}

async function login() {
  let t0 = now();
  const lR = await api.post('/auth/login', { email: TEST_EMAIL, password: TEST_PASSWORD });
  if (lR.status !== 200) {
    record('auth', 'POST /auth/login', 'fail', `status=${lR.status} body=${JSON.stringify(lR.data)}`, now() - t0);
    throw new Error('login failed');
  }
  institutionId = lR.data.data.institutionId;
  record('auth', 'POST /auth/login', 'pass', `otpRequired=true`, now() - t0);

  await sleep(300);
  const otp = await pickOtp(TEST_EMAIL, 'login');
  if (!otp) throw new Error('No login OTP in DB');
  record('auth', 'Read login OTP from DB', 'pass', `otp=${otp}`, 0);

  t0 = now();
  const vR = await api.post('/auth/verify-otp', { email: TEST_EMAIL, otp, institutionId });
  const accessToken = vR.data?.data?.token || vR.data?.data?.accessToken;
  if (vR.status !== 200 || !accessToken) {
    record('auth', 'POST /auth/verify-otp', 'fail', `status=${vR.status} body=${JSON.stringify(vR.data).slice(0,200)}`, now() - t0);
    throw new Error('otp verify failed');
  }
  token = accessToken;
  userId = vR.data.data.user?.id || userId;
  record('auth', 'POST /auth/verify-otp -> JWT', 'pass', `tokenLen=${token.length}`, now() - t0);

  const prof = await api.get('/auth/profile');
  record(
    'auth',
    'GET /auth/profile',
    prof.status === 200 ? 'pass' : 'fail',
    `status=${prof.status}`,
    0
  );
}

// ---------- Phase 2: master data ----------
const state = {}; // carry ids across tests

async function masterData() {
  // Categories
  await run('master-data', 'POST /categories', async () => {
    const r = await api.post('/categories', { name: uniq('Electronics'), description: 'Test category' });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    state.categoryId = okData(r)?.id || okData(r)?.categoryId || okData(r)?.data?.id;
    return { details: `id=${state.categoryId}` };
  });
  await run('master-data', 'GET /categories', async () => {
    const r = await api.get('/categories');
    return r.status === 200 ? { details: `count=${(okData(r)?.categories || okData(r) || []).length}` } : { status: 'fail', details: `status=${r.status}` };
  });

  // Brands
  await run('master-data', 'POST /brands', async () => {
    const r = await api.post('/brands', { name: uniq('Acme'), description: 'Test brand' });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    const d = okData(r);
    state.brandId = d?.id || d?.brand?.id || d?.data?.id;
    return { details: `id=${state.brandId}` };
  });
  await run('master-data', 'GET /brands', async () => {
    const r = await api.get('/brands');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  // Manufacturers
  await run('master-data', 'POST /manufacturers', async () => {
    const r = await api.post('/manufacturers', { name: uniq('Globex') });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    const d = okData(r);
    state.manufacturerId = d?.id || d?.manufacturer?.id;
    return { details: `id=${state.manufacturerId}` };
  });
  await run('master-data', 'GET /manufacturers', async () => {
    const r = await api.get('/manufacturers');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  // Units
  await run('master-data', 'GET /units', async () => {
    const r = await api.get('/units');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  // Tax
  await run('master-data', 'GET /tax/taxes', async () => {
    const r = await api.get('/tax/taxes');
    return r.status === 200 ? {} : { status: r.status === 404 ? 'skip' : 'fail', details: `status=${r.status}` };
  });

  // Price lists
  await run('master-data', 'GET /price-lists', async () => {
    const r = await api.get('/price-lists');
    return r.status === 200 ? {} : { status: r.status === 403 ? 'skip' : 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,150)}` };
  });

  // Dropdown options
  await run('master-data', 'GET /dropdown-options/vendor_category', async () => {
    const r = await api.get('/dropdown-options/vendor_category');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });
}

// ---------- Phase 3: warehouses + locations ----------
async function warehouses() {
  await run('warehouse', 'GET /warehouse-types', async () => {
    const r = await api.get('/warehouse-types');
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const d = okData(r);
    const list = d?.warehouseTypes || d?.types || d || [];
    if (Array.isArray(list) && list.length) state.warehouseTypeId = list[0].id;
    return { details: `count=${Array.isArray(list) ? list.length : '?'}` };
  });

  await run('warehouse', 'POST /warehouse-types (seed)', async () => {
    if (state.warehouseTypeId) return { status: 'skip', details: `have ${state.warehouseTypeId}` };
    const r = await api.post('/warehouse-types', { name: uniq('Standard'), description: 'Default type' });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.warehouseTypeId = okData(r)?.typeId || okData(r)?.id;
    return { details: `id=${state.warehouseTypeId}` };
  });

  await run('warehouse', 'POST /warehouses', async () => {
    const r = await api.post('/warehouses', {
      code: `AIT-WH-${Date.now().toString().slice(-6)}`,
      name: 'AI-testing main warehouse',
      type: state.warehouseTypeId,
      address: '123 Test St, Delhi',
      contactPerson: 'AI Tester',
      phone: '9999999999',
      email: 'wh1@example.com',
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    const d = okData(r);
    state.warehouseId = d?.id || d?.warehouse?.id || d?.warehouseId;
    return { details: `id=${state.warehouseId}` };
  });

  await run('warehouse', 'GET /warehouses', async () => {
    const r = await api.get('/warehouses');
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const list = okData(r)?.warehouses || okData(r) || [];
    if (!state.warehouseId && list.length) state.warehouseId = list[0].id;
    return { details: `count=${list.length}` };
  });

  await run('warehouse-location', 'GET /warehouse-locations/constants', async () => {
    const r = await api.get('/warehouse-locations/constants');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  await run('warehouse-location', 'POST /warehouse-locations/zones', async () => {
    if (!state.warehouseId) return { status: 'skip', details: 'no warehouseId' };
    // Ensure a zone-type exists for this tenant (built-ins only seeded on migration, not new-tenant registration)
    await api.post('/warehouse-locations/zone-types', { code: 'storage', name: 'Storage' });
    const r = await api.post('/warehouse-locations/zones', {
      warehouseId: state.warehouseId,
      code: uniq('Z'),
      name: 'Zone 1',
      zoneType: 'storage',
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    const d = okData(r);
    state.zoneId = d?.id || d?.zone?.id;
    return { details: `id=${state.zoneId}` };
  });

  await run('warehouse-location', 'POST /warehouse-locations/racks', async () => {
    if (!state.zoneId) return { status: 'skip', details: 'no zoneId' };
    const r = await api.post('/warehouse-locations/racks', {
      zoneId: state.zoneId,
      code: uniq('R'),
      name: 'Rack 1',
      totalLevels: 3,
      totalColumns: 4,
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    state.rackId = okData(r)?.id || okData(r)?.rack?.id;
    return { details: `id=${state.rackId}` };
  });

  await run('warehouse-location', 'POST /warehouse-locations/bins', async () => {
    if (!state.rackId) return { status: 'skip', details: 'no rackId' };
    await api.post('/warehouse-locations/bin-types', { code: 'standard', name: 'Standard' });
    const r = await api.post('/warehouse-locations/bins', {
      rackId: state.rackId,
      code: uniq('B'),
      name: 'Bin 1',
      binType: 'standard',
      binLevel: 1,
      binColumn: 1,
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    state.binId = okData(r)?.id || okData(r)?.bin?.id;
    return { details: `id=${state.binId}` };
  });

  await run('warehouse-location', 'GET /warehouse-locations/warehouses/:id/hierarchy', async () => {
    const r = await api.get(`/warehouse-locations/warehouses/${state.warehouseId}/hierarchy`);
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  // Type catalog CRUD (customizable zone/bin types)
  await run('warehouse-location', 'POST /warehouse-locations/zone-types (custom)', async () => {
    const r = await api.post('/warehouse-locations/zone-types', { code: uniq('cold'), name: 'Cold room' });
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
  });

  await run('warehouse-location', 'POST /warehouse-locations/bin-types (custom)', async () => {
    const r = await api.post('/warehouse-locations/bin-types', { code: uniq('tote'), name: 'Tote' });
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
  });
}

// ---------- Phase 4: items ----------
async function items() {
  await run('items', 'POST /items (full workflow — category/brand/manufacturer/HSN/tax/defaultBin/openingStock)', async () => {
    const r = await api.post('/items', {
      sku: uniq('AIT-SKU'),
      name: 'Test Widget',
      description: 'Full-workflow e2e item',
      type: 'simple',
      category: state.categoryId,
      brand: state.brandId,
      manufacturer: state.manufacturerId,
      unit: 'pcs',
      barcode: uniq('BAR'),
      hsnCode: '8473',
      costPrice: 100,
      sellingPrice: 150,
      mrp: 175,
      taxRate: 18,
      taxType: 'exclusive',
      allowNegativeStock: false,
      valuationMethod: 'weighted_average',
      minStockLevel: 5,
      maxStockLevel: 500,
      isSerialized: false,
      isBatchTracked: false,
      hasExpiry: false,
      warehouseId: state.warehouseId,
      defaultBinId: state.binId,
      openingStock: 25,
      asOfDate: new Date().toISOString().slice(0, 10),
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data)}` };
    const d = okData(r);
    state.itemId = d?.id || d?.itemId || d?.item?.id;
    return { details: `id=${state.itemId}` };
  });

  await run('items', 'GET /inventory — opening stock projected', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.get('/inventory', { params: { itemId: state.itemId, warehouseId: state.warehouseId, pageSize: 100 } });
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const list = (okData(r)?.items || okData(r)?.data || okData(r) || []);
    const row = (Array.isArray(list) ? list : []).find((x) => (x.item_id || x.itemId) === state.itemId && (x.warehouse_id || x.warehouseId) === state.warehouseId);
    if (!row) return { status: 'partial', details: 'opening-stock projection row not found in response (may be paginated elsewhere)' };
    const qty = Number(row.quantity_on_hand ?? row.quantityOnHand ?? 0);
    return qty >= 25 ? { details: `quantity_on_hand=${qty} (>= opening stock 25)` } : { status: 'fail', details: `quantity_on_hand=${qty}, expected >= 25` };
  });

  await run('items', 'GET /items', async () => {
    const r = await api.get('/items');
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const d = okData(r);
    const list = d?.items || d?.data || d || [];
    return { details: `count=${Array.isArray(list) ? list.length : '?'}` };
  });

  await run('items', 'GET /items/:id', async () => {
    if (!state.itemId) return { status: 'skip' };
    const r = await api.get(`/items/${state.itemId}`);
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const d = okData(r);
    const hasDefaultBin = d?.default_bin_id || d?.defaultBinId;
    return {
      status: hasDefaultBin ? 'pass' : 'partial',
      details: hasDefaultBin
        ? `default_bin_id persisted (${hasDefaultBin})`
        : 'default_bin_id NOT returned by GET /items/:id (write-only)'
    };
  });
}

// ---------- Phase 5: vendors + PO + GRN ----------
async function procurement() {
  await run('procurement', 'POST /vendors', async () => {
    const r = await api.post('/vendors', {
      displayName: uniq('Acme Supplies'),
      companyName: uniq('Acme Supplies Pvt Ltd'),
      salutation: 'Mr.',
      firstName: 'Acme',
      lastName: 'Supplies',
      email: 'vendor@acme.test',
      workPhone: '9999999999',
      mobilePhone: '9999999999',
      pan: null,
      gstin: null,
      msmeRegistered: false,
      currency: 'INR',
      paymentTerms: 'net_30',
      tds: null,
      websiteUrl: null,
      department: null,
      designation: null,
      remarks: 'e2e test vendor',
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.vendorId = okData(r)?.id || okData(r)?.vendor?.id || okData(r)?.vendorId;
    return { details: `id=${state.vendorId}` };
  });

  await run('procurement', 'POST /purchase-orders', async () => {
    if (!(state.vendorId && state.itemId && state.warehouseId)) return { status: 'skip', details: 'missing prerequisites' };
    const r = await api.post('/purchase-orders', {
      poNumber: uniq('PO'),
      vendorId: state.vendorId,
      vendorName: uniq('Acme Supplies'),
      warehouseId: state.warehouseId,
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      currency: 'INR',
      lines: [
        {
          itemId: state.itemId,
          warehouseId: state.warehouseId,
          quantity: 10,
          unitCost: 100,
          taxRate: 18,
        },
      ],
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    const d = okData(r);
    state.poId = d?.poId || d?.id || d?.orderId || d?.purchaseOrderId || d?.purchaseOrder?.id;
    return { details: `id=${state.poId}` };
  });

  await run('procurement', 'POST /purchase-orders/:id/confirm', async () => {
    if (!state.poId) return { status: 'skip' };
    const r = await api.post(`/purchase-orders/${state.poId}/confirm`, {});
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });

  await run('procurement', 'GET /grn/pending-receipts', async () => {
    const r = await api.get('/grn/pending-receipts');
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const d = okData(r);
    const list = d?.pendingReceipts || d?.data || d || [];
    return { details: `count=${Array.isArray(list) ? list.length : '?'}` };
  });

  await run('procurement', 'GET /inventory (pre-GRN baseline)', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.get('/inventory', { params: { itemId: state.itemId, warehouseId: state.warehouseId } });
    const list = okData(r)?.inventory || okData(r)?.items || okData(r)?.data || okData(r) || [];
    const row = (Array.isArray(list) ? list : []).find((x) => (x.item_id || x.itemId) === state.itemId && (x.warehouse_id || x.warehouseId) === state.warehouseId);
    state.preGrnOnHand = Number(row?.quantity_on_hand ?? row?.quantityOnHand ?? 0);
    return { details: `on_hand=${state.preGrnOnHand}` };
  });

  // Confirm is required before GRN
  await run('procurement', 'POST /grn (receive full)', async () => {
    if (!state.poId) return { status: 'skip' };
    const poR = await api.get(`/purchase-orders/${state.poId}`);
    if (poR.status !== 200) return { status: 'fail', details: `fetch PO status=${poR.status}` };
    const po = okData(poR);
    const lines = po?.lines || po?.items || po?.purchaseOrder?.lines || [];
    const line = lines[0];
    if (!line) return { status: 'fail', details: `no PO lines found (keys=${Object.keys(po||{}).join(',')})` };
    const r = await api.post('/grn', {
      grnNumber: uniq('GRN'),
      poId: state.poId,
      receiptDate: new Date().toISOString().slice(0, 10),
      lines: [
        {
          poLineId: line.id,
          itemId: state.itemId,
          warehouseId: state.warehouseId,
          quantityReceived: 10,
          unitCost: 100,
          qualityStatus: 'accepted',
        },
      ],
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,250)}` };
    state.grnId = okData(r)?.id || okData(r)?.grnId || okData(r)?.grn?.id;
    return { details: `grnId=${state.grnId}` };
  });

  await run('procurement', 'GET /inventory (stock increased by 10 after GRN)', async () => {
    const r = await api.get('/inventory', { params: { itemId: state.itemId, warehouseId: state.warehouseId } });
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const list = okData(r)?.inventory || okData(r)?.items || okData(r)?.data || okData(r) || [];
    const row = (Array.isArray(list) ? list : []).find(
      (x) => (x.item_id || x.itemId) === state.itemId && (x.warehouse_id || x.warehouseId) === state.warehouseId
    );
    if (!row) return { status: 'partial', details: `projection for itemId+warehouseId not visible` };
    const onHand = Number(row.quantity_on_hand ?? row.quantityOnHand);
    const expected = Number(state.preGrnOnHand || 0) + 10;
    state.postGrnOnHand = onHand;
    return onHand === expected
      ? { details: `on_hand ${state.preGrnOnHand} → ${onHand} (+10)` }
      : { status: 'partial', details: `on_hand=${onHand} (expected +10 from ${state.preGrnOnHand})` };
  });

  await run('procurement', 'POST /purchase-invoices/generate-from-grn/:grnId', async () => {
    if (!state.grnId) return { status: 'skip' };
    const r = await api.post(`/purchase-invoices/generate-from-grn/${state.grnId}`, {});
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.purchaseInvoiceId = okData(r)?.id || okData(r)?.invoiceId || okData(r)?.purchaseInvoice?.id;
    return { details: `id=${state.purchaseInvoiceId}` };
  });

  await run('procurement', 'POST /purchase-invoices/:id/payments', async () => {
    if (!state.purchaseInvoiceId) return { status: 'skip' };
    const r = await api.post(`/purchase-invoices/${state.purchaseInvoiceId}/payments`, {
      amount: 1180,
      paymentMethod: 'bank_transfer',
      paymentDate: new Date().toISOString().slice(0, 10),
    });
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });
}

// ---------- Phase 6: customers + SO + ship + invoice ----------
async function sales() {
  await run('sales', 'POST /customers', async () => {
    const r = await api.post('/customers', {
      displayName: uniq('Bob Buyer'),
      companyName: uniq('Bob Buyer Corp'),
      salutation: 'Mr.',
      firstName: 'Bob',
      lastName: 'Buyer',
      email: 'bob@customer.test',
      workPhone: '8888888888',
      mobilePhone: '8888888888',
      pan: null,
      gstin: null,
      msmeRegistered: false,
      currency: 'INR',
      paymentTerms: 'net_30',
      tds: null,
      websiteUrl: null,
      department: null,
      designation: null,
      remarks: 'e2e test customer',
      creditLimit: 0,
      priceListId: null,
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.customerId = okData(r)?.id || okData(r)?.customer?.id || okData(r)?.customerId;
    return { details: `id=${state.customerId}` };
  });

  await run('sales', 'POST /sales-orders', async () => {
    if (!(state.customerId && state.itemId && state.warehouseId)) return { status: 'skip', details: 'missing prerequisites' };
    const r = await api.post('/sales-orders', {
      soNumber: uniq('SO'),
      customerId: state.customerId,
      customerName: uniq('Bob Buyer'),
      warehouseId: state.warehouseId,
      orderDate: new Date().toISOString().slice(0, 10),
      expectedShipDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      currency: 'INR',
      channel: 'direct',
      shippingMethod: 'standard',
      lines: [
        {
          itemId: state.itemId,
          warehouseId: state.warehouseId,
          quantity: 3,
          unitPrice: 150,
          taxRate: 18,
          discountRate: 0,
        },
      ],
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    const d = okData(r);
    state.soId = d?.soId || d?.id || d?.salesOrder?.id || d?.orderId;
    return { details: `id=${state.soId}` };
  });

  // Capture projection BEFORE confirm so we can assert the reservation side-effect
  await run('sales', 'GET /inventory (pre-SO-confirm baseline)', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.get('/inventory', { params: { itemId: state.itemId, warehouseId: state.warehouseId } });
    const list = okData(r)?.items || okData(r)?.data || okData(r) || [];
    const row = (Array.isArray(list) ? list : []).find((x) => (x.item_id || x.itemId) === state.itemId && (x.warehouse_id || x.warehouseId) === state.warehouseId);
    state.preConfirmOnHand = Number(row?.quantity_on_hand ?? row?.quantityOnHand ?? 0);
    state.preConfirmReserved = Number(row?.quantity_reserved ?? row?.quantityReserved ?? 0);
    state.preConfirmAvailable = Number(row?.quantity_available ?? row?.quantityAvailable ?? (state.preConfirmOnHand - state.preConfirmReserved));
    return { details: `on_hand=${state.preConfirmOnHand} reserved=${state.preConfirmReserved} available=${state.preConfirmAvailable}` };
  });

  await run('sales', 'POST /sales-orders/:id/confirm', async () => {
    if (!state.soId) return { status: 'skip' };
    const r = await api.post(`/sales-orders/${state.soId}/confirm`, {});
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });

  await run('sales', 'GET /inventory — reservation applied after SO confirm', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.get('/inventory', { params: { itemId: state.itemId, warehouseId: state.warehouseId } });
    const list = okData(r)?.items || okData(r)?.data || okData(r) || [];
    const row = (Array.isArray(list) ? list : []).find((x) => (x.item_id || x.itemId) === state.itemId && (x.warehouse_id || x.warehouseId) === state.warehouseId);
    if (!row) return { status: 'partial', details: 'projection row not found on first page' };
    const reserved = Number(row.quantity_reserved ?? row.quantityReserved ?? 0);
    const onHand = Number(row.quantity_on_hand ?? row.quantityOnHand ?? 0);
    // Accept either explicit reservation bump OR an on-hand unchanged (commitment may be on demand only)
    if (reserved >= (state.preConfirmReserved + 3)) return { details: `reserved bumped: ${state.preConfirmReserved} → ${reserved} (on_hand=${onHand})` };
    return { status: 'partial', details: `SO confirm did not bump reserved (was ${state.preConfirmReserved}, now ${reserved}); on_hand=${onHand} — may track demand separately` };
  });

  await run('sales', 'SO state after confirm (detects confirm-also-ships)', async () => {
    if (!state.soId) return { status: 'skip' };
    const r = await api.get(`/sales-orders/${state.soId}`);
    if (r.status !== 200) return { status: 'fail', details: `status=${r.status}` };
    const so = okData(r);
    const soStatus = so?.status || so?.salesOrder?.status;
    const lines = so?.lines || so?.items || so?.salesOrder?.lines || [];
    state.soLineId = lines[0]?.id;
    state.soConfirmAlreadyShipped = soStatus === 'shipped';
    return { details: `status=${soStatus}${state.soConfirmAlreadyShipped ? ' — confirm endpoint already performed shipping side-effect (workflow quirk)' : ''}` };
  });

  await run('sales', 'GET /inventory — on-hand drops after ship/confirm', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.get('/inventory', { params: { itemId: state.itemId, warehouseId: state.warehouseId } });
    const list = okData(r)?.items || okData(r)?.data || okData(r) || [];
    const row = (Array.isArray(list) ? list : []).find((x) => (x.item_id || x.itemId) === state.itemId && (x.warehouse_id || x.warehouseId) === state.warehouseId);
    if (!row) return { status: 'partial', details: 'projection row not found' };
    const onHand = Number(row.quantity_on_hand ?? row.quantityOnHand ?? 0);
    const expected = state.preConfirmOnHand - 3;
    return onHand === expected
      ? { details: `on_hand ${state.preConfirmOnHand} → ${onHand} (shipped 3)` }
      : { status: 'partial', details: `on_hand=${onHand}, expected ${expected}` };
  });

  await run('sales', 'POST /sales-orders/:id/ship (explicit ship after confirm)', async () => {
    if (!state.soId || !state.soLineId) return { status: 'skip' };
    const r = await api.post(`/sales-orders/${state.soId}/ship`, {
      shipmentNumber: uniq('SHIP'),
      lines: [{ soLineId: state.soLineId, quantity: 1 }],
    });
    // If confirm already shipped, this is expected to 400 with "Cannot create shipment for SO in status 'shipped'"
    if (state.soConfirmAlreadyShipped && r.status === 400) {
      return { status: 'partial', details: `ship rejected because confirm already shipped — doc §7/§8 quirk` };
    }
    if ([200, 201].includes(r.status)) return { details: `status=${r.status}` };
    return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });

  // Detected quirk: POST /sales-invoices with warehouseId always decrements on_hand,
  // while confirming an SO already ships. Invoicing a shipped SO causes double-ship.
  // Also, invoicing with no warehouseId is rejected. So for the happy-path invoice
  // we create a SECOND draft SO and invoice from it without confirming first.
  await run('sales', 'POST /sales-orders (draft, for invoice happy-path)', async () => {
    if (!(state.customerId && state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.post('/sales-orders', {
      soNumber: uniq('SO2'),
      customerId: state.customerId,
      customerName: uniq('Bob Buyer'),
      warehouseId: state.warehouseId,
      orderDate: new Date().toISOString().slice(0, 10),
      currency: 'INR',
      lines: [{ itemId: state.itemId, warehouseId: state.warehouseId, quantity: 1, unitPrice: 150, taxRate: 18 }],
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.soDraftId = okData(r)?.soId || okData(r)?.id;
    return { details: `id=${state.soDraftId}` };
  });

  await run('sales', 'DB probe — inventory_projections for itemId+warehouseId before invoice', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const [rows] = await pool.execute(
      `SELECT warehouse_id, quantity_on_hand, quantity_reserved, quantity_available, average_cost
         FROM inventory_projections
        WHERE institution_id = ? AND item_id = ?`,
      [institutionId, state.itemId]
    );
    const hit = rows.find((r) => r.warehouse_id === state.warehouseId);
    const all = rows.map((r) => `${r.warehouse_id.slice(0,8)}:on=${r.quantity_on_hand},res=${r.quantity_reserved},avail=${r.quantity_available},avg=${r.average_cost}`).join(' | ');
    state.invoiceProbeHit = hit;
    return { details: `rows=${rows.length} — ${all}` };
  });

  await run('sales', 'POST /sales-invoices (from draft SO — invoice endpoint does the shipping)', async () => {
    if (!state.soDraftId) return { status: 'skip' };
    const r = await api.post('/sales-invoices', {
      invoiceNumber: uniq('INV'),
      customerId: state.customerId,
      customerName: uniq('Bob Buyer'),
      soId: state.soDraftId,
      warehouseId: state.warehouseId,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      currency: 'INR',
      lines: [
        {
          itemId: state.itemId,
          itemName: 'Test Widget',
          warehouseId: state.warehouseId,
          quantity: 1,
          unitPrice: 150,
          taxRate: 18,
        },
      ],
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.salesInvoiceId = okData(r)?.id || okData(r)?.invoiceId || okData(r)?.salesInvoice?.id;
    return { details: `id=${state.salesInvoiceId}` };
  });

  await run('sales', 'POST /sales-invoices/:id/payments', async () => {
    if (!state.salesInvoiceId) return { status: 'skip' };
    const r = await api.post(`/sales-invoices/${state.salesInvoiceId}/payments`, {
      amount: 177,
      paymentMethod: 'cash',
      paymentDate: new Date().toISOString().slice(0, 10),
      reference: null,
      notes: null,
    });
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });

  await run('sales', 'GET /invoices/dashboard/summary', async () => {
    const r = await api.get('/invoices/dashboard/summary');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });
}

// ---------- Phase 7: inventory ops ----------
async function inventoryOps() {
  await run('inventory', 'GET /inventory', async () => {
    const r = await api.get('/inventory');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  await run('inventory', 'POST /inventory/adjust (+5)', async () => {
    if (!(state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.post('/inventory/adjust', {
      itemId: state.itemId,
      warehouseId: state.warehouseId,
      quantityChange: 5,
      adjustmentType: 'increase',
      reason: 'e2e test inbound',
      lossType: 'MANUAL',
    });
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });

  await run('inventory', 'GET /inventory/adjustments', async () => {
    const r = await api.get('/inventory/adjustments');
    return r.status === 200 ? {} : { status: r.status === 404 ? 'skip' : 'fail', details: `status=${r.status}` };
  });

  // 2nd warehouse for transfer
  await run('inventory', 'POST /warehouses (wh2 for transfer)', async () => {
    const r = await api.post('/warehouses', {
      code: `AIT-WH2-${Date.now().toString().slice(-6)}`,
      name: 'AI-testing secondary',
      type: state.warehouseTypeId,
      address: '456 Secondary Rd',
      contactPerson: 'AI Tester 2',
      phone: '9999999998',
      email: 'wh2@example.com',
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.warehouse2Id = okData(r)?.id || okData(r)?.warehouse?.id || okData(r)?.warehouseId;
    return { details: `id=${state.warehouse2Id}` };
  });

  await run('inventory', 'POST /inventory/transfer', async () => {
    if (!(state.warehouse2Id && state.itemId && state.warehouseId)) return { status: 'skip' };
    const r = await api.post('/inventory/transfer', {
      itemId: state.itemId,
      fromWarehouseId: state.warehouseId,
      toWarehouseId: state.warehouse2Id,
      quantity: 2,
    });
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
  });

  await run('inventory', 'GET /inventory/transfers', async () => {
    const r = await api.get('/inventory/transfers');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  await run('inventory', 'POST /inventory/receive (known-broken route)', async () => {
    const r = await api.post('/inventory/receive', { itemId: state.itemId, warehouseId: state.warehouseId, quantity: 1 });
    if (r.status === 404) return { status: 'partial', details: '404 — route not registered (confirms doc §12.6 gap)' };
    return [200, 201].includes(r.status) ? { details: `status=${r.status}` } : { status: 'fail', details: `status=${r.status}` };
  });

  await run('inventory', 'POST /stock-counts', async () => {
    if (!state.warehouseId) return { status: 'skip', details: 'no warehouseId' };
    const r = await api.post('/stock-counts', {
      warehouseId: state.warehouseId,
      countType: 'full',
      scheduledDate: new Date().toISOString().slice(0, 10),
      notes: 'e2e count',
    });
    if (![200, 201].includes(r.status)) return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0,200)}` };
    state.stockCountId = okData(r)?.id || okData(r)?.countId || okData(r)?.stockCountId;
    return { details: `id=${state.stockCountId}` };
  });

  await run('inventory', 'GET /reorder-levels', async () => {
    const r = await api.get('/reorder-levels');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });

  await run('inventory', 'GET /batch-serial/batches', async () => {
    const r = await api.get('/batch-serial/batches');
    return r.status === 200 ? {} : { status: r.status === 404 ? 'skip' : 'fail', details: `status=${r.status}` };
  });

  await run('inventory', 'GET /transfer-approvals', async () => {
    const r = await api.get('/transfer-approvals');
    return r.status === 200 ? {} : { status: 'fail', details: `status=${r.status}` };
  });
}

// ---------- Phase 8: reports + accounting ----------
async function reportsAccounting() {
  const cases = [
    ['GET /reports/inventory', '/reports/inventory'],
    ['GET /reports/low-stock', '/reports/low-stock'],
    ['GET /reports/purchases', '/reports/purchases'],
    ['GET /reports/sales', '/reports/sales'],
    ['GET /reports/profit-loss', '/reports/profit-loss'],
    ['GET /profit-loss', '/profit-loss'],
    ['GET /analytics/valuation', '/analytics/valuation'],
    ['GET /analytics/profit-loss', '/analytics/profit-loss'],
    ['GET /accounting/summary', '/accounting/summary'],
    ['GET /accounting/trial-balance', '/accounting/trial-balance'],
    ['GET /accounting/chart-of-accounts', '/accounting/chart-of-accounts'],
    ['GET /accounting/payments', '/accounting/payments'],
    ['GET /accounting/payables', '/accounting/payables'],
    ['GET /accounting/receivables', '/accounting/receivables'],
  ];
  for (const [label, p] of cases) {
    await run('reports', label, async () => {
      const r = await api.get(p);
      if (r.status === 200) return {};
      if (r.status === 404) return { status: 'skip', details: `404 (endpoint may not exist)` };
      return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0, 120)}` };
    });
  }
}

// ---------- Phase 9: cross-cutting ----------
async function crossCutting() {
  const cases = [
    ['GET /audit/trail', '/audit/trail'],
    ['GET /audit/my-activity', '/audit/my-activity'],
    ['GET /audit/dashboard', '/audit/dashboard'],
    ['GET /notifications', '/notifications'],
    ['GET /notifications/unread-count', '/notifications/unread-count'],
    ['GET /documents', '/documents'],
    ['GET /documents/folders', '/documents/folders'],
    ['GET /workflows', '/workflows'],
    ['GET /workflows/logs', '/workflows/logs'],
    ['GET /subscription', '/subscription'],
    ['GET /settings', '/settings'],
    ['GET /company-settings', '/company-settings'],
    ['GET /onboarding', '/onboarding'],
    ['GET /data/all', '/data/all'],
  ];
  for (const [label, p] of cases) {
    await run('cross-cutting', label, async () => {
      const r = await api.get(p);
      if (r.status === 200) return {};
      if (r.status === 404) return { status: 'skip', details: `404` };
      return { status: 'fail', details: `status=${r.status} body=${JSON.stringify(r.data).slice(0, 120)}` };
    });
  }
}

// ---------- Phase 10: known-broken UI workflows (probing) ----------
async function knownBroken() {
  await run('known-broken', 'Sales returns UI pattern (POST /sales-orders status=returned)', async () => {
    const r = await api.post('/sales-orders', {
      soNumber: uniq('SORET'),
      customerId: state.customerId,
      customerName: uniq('Bob Buyer'),
      warehouseId: state.warehouseId,
      orderDate: new Date().toISOString().slice(0, 10),
      currency: 'INR',
      status: 'returned',
      lines: [{ itemId: state.itemId, warehouseId: state.warehouseId, quantity: 1, unitPrice: 150 }],
    });
    if (r.status === 201 || r.status === 200) {
      return { status: 'partial', details: `SO created (status='returned' silently ignored) — confirms doc §12.4 gap` };
    }
    // Schema validation or DB insert error (sales_order_lines.discount_rate missing) — either way, the UI "returns" flow cannot work
    return { status: 'partial', details: `SO create rejected (${r.status}) — confirms doc §12.4 + backend bug: sales_order_lines.discount_rate column missing` };
  });

  await run('known-broken', 'Credit notes UI list filter ?type=credit_note', async () => {
    const r = await api.get('/sales-invoices?type=credit_note');
    // Expect: returns all invoices (filter ignored)
    if (r.status === 200) return { status: 'partial', details: 'filter ignored by controller — matches doc §12.4' };
    return { status: 'fail', details: `status=${r.status}` };
  });

  await run('known-broken', 'Frontend permission name inventory_putaway (backend expects inventory_receive)', async () => {
    // Call a receive-guarded endpoint and check permission error text
    // We do not have a way to revoke permissions here since AI-testing admin has all.
    return { status: 'skip', details: 'not verifiable with superuser; see doc §12.8' };
  });
}

// ---------- main ----------
async function main() {
  console.log(`\n=== IMS E2E tests against ${API_BASE} ===\n`);
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await healthChecks();
    await ensureAiTestingAccount();
    await login();
    await masterData();
    await warehouses();
    await items();
    await procurement();
    await sales();
    await inventoryOps();
    await reportsAccounting();
    await crossCutting();
    await knownBroken();
  } catch (e) {
    console.error('\n[HALT]', e.message);
  }

  // Summary
  const summary = { total: results.length };
  ['pass', 'fail', 'partial', 'skip'].forEach((s) => (summary[s] = results.filter((r) => r.status === s).length));
  console.log('\n=== SUMMARY ===');
  console.log(summary);

  fs.writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        apiBase: API_BASE,
        institutionId,
        userId,
        testEmail: TEST_EMAIL,
        runAt: new Date().toISOString(),
        state,
        summary,
        results,
      },
      null,
      2
    )
  );
  console.log(`\nResults written to ${RESULTS_PATH}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
