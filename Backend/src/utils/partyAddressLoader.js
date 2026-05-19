const db = require('../database/connection');

const COLLATE = 'utf8mb4_unicode_ci';

function mapRowToAddress(row) {
  if (!row) return {};
  return {
    attention: row.attention || '',
    line1: row.address1 || '',
    line2: row.address2 || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    postalCode: row.pin_code || '',
  };
}

/**
 * Load billing/shipping rows for a customer (collation-safe entity_id match).
 */
async function loadCustomerAddressesFromTable(customerId) {
  if (!customerId) return { billing: {}, shipping: {} };

  const rows = await db.query(
    `SELECT address_type, attention, country, address1, address2, city, state, pin_code
       FROM addresses
      WHERE entity_type = 'customer'
        AND entity_id COLLATE ${COLLATE} = CAST(? AS CHAR) COLLATE ${COLLATE}`,
    [customerId]
  );

  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const billing = {};
  const shipping = {};

  list.forEach((row) => {
    const type = String(row.address_type || '').toLowerCase();
    const mapped = mapRowToAddress(row);
    if (type === 'billing') Object.assign(billing, mapped);
    if (type === 'shipping') Object.assign(shipping, mapped);
  });

  return { billing, shipping };
}

async function resolveCustomerId(institutionId, { customerId, customerName }) {
  if (customerId) return customerId;
  const name = String(customerName || '').trim();
  if (!name || !institutionId) return null;

  const rows = await db.query(
    `SELECT id FROM customers
      WHERE institution_id COLLATE ${COLLATE} = CAST(? AS CHAR) COLLATE ${COLLATE}
        AND status = 'active'
        AND (display_name = ? OR company_name = ?)
      LIMIT 1`,
    [institutionId, name, name]
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row?.id || null;
}

async function loadVendorAddressesFromTable(vendorId) {
  if (!vendorId) return { billing: {}, shipping: {} };

  const rows = await db.query(
    `SELECT address_type, attention, country, address1, address2, city, state, pin_code
       FROM addresses
      WHERE entity_type = 'vendor'
        AND entity_id COLLATE ${COLLATE} = CAST(? AS CHAR) COLLATE ${COLLATE}`,
    [vendorId]
  );

  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const billing = {};
  const shipping = {};

  list.forEach((row) => {
    const type = String(row.address_type || '').toLowerCase();
    const mapped = mapRowToAddress(row);
    if (type === 'billing') Object.assign(billing, mapped);
    if (type === 'shipping') Object.assign(shipping, mapped);
  });

  return { billing, shipping };
}

module.exports = {
  loadCustomerAddressesFromTable,
  loadVendorAddressesFromTable,
  resolveCustomerId,
  mapRowToAddress,
};
