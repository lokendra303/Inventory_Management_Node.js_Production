const db = require('../../database/connection');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function clampLimit(limit) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function clampOffset(offset) {
  const n = parseInt(offset, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function mapRow(row) {
  return {
    id: row.reference_id,
    type: row.transaction_type,
    documentNumber: row.document_number,
    date: row.transaction_date,
    status: row.status,
    amount: Number(row.amount) || 0,
    currency: row.currency || null,
    balanceAmount: row.balance_amount != null ? Number(row.balance_amount) : null,
    relatedId: row.related_id || null,
    relatedType: row.related_type || null,
    createdAt: row.sort_at,
  };
}

async function countUnion(sql, params) {
  const rows = await db.query(
    `SELECT COUNT(*) AS total FROM (${sql}) AS combined`,
    params
  );
  return Number(rows[0]?.total) || 0;
}

async function fetchUnionPage(unionSql, params, limit, offset) {
  // mysql2 prepared statements do not support LIMIT/OFFSET placeholders reliably
  const safeLimit = clampLimit(limit);
  const safeOffset = clampOffset(offset);
  return db.query(
    `SELECT * FROM (${unionSql}) AS combined
     ORDER BY transaction_date DESC, sort_at DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );
}

async function getCustomerTransactionHistory(institutionId, customerId, options = {}) {
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);

  const unionSql = `
    SELECT so.id AS reference_id, CAST('sales_order' AS CHAR(32)) AS transaction_type,
      so.so_number AS document_number, so.order_date AS transaction_date,
      CAST(so.status AS CHAR(32)) AS status,
      CAST(so.total_amount AS DECIMAL(15,2)) AS amount,
      CAST(so.currency AS CHAR(3)) AS currency,
      CAST(NULL AS DECIMAL(15,2)) AS balance_amount,
      CAST(NULL AS CHAR(36)) AS related_id,
      CAST(NULL AS CHAR(32)) AS related_type,
      so.created_at AS sort_at
    FROM sales_orders so
    WHERE so.institution_id = ? AND so.customer_id = ?

    UNION ALL

    SELECT si.id, CAST('sales_invoice' AS CHAR(32)), si.invoice_number, si.invoice_date,
      CAST(si.status AS CHAR(32)),
      CAST(si.total_amount AS DECIMAL(15,2)), CAST(si.currency AS CHAR(3)),
      CAST(si.balance_amount AS DECIMAL(15,2)),
      CAST(NULL AS CHAR(36)), CAST(NULL AS CHAR(32)), si.created_at
    FROM sales_invoices si
    WHERE si.institution_id = ? AND si.customer_id = ?

    UNION ALL

    SELECT dc.id, CAST('delivery_challan' AS CHAR(32)), dc.challan_number, dc.challan_date,
      CAST(dc.status AS CHAR(32)),
      CAST(0 AS DECIMAL(15,2)), CAST(NULL AS CHAR(3)),
      CAST(NULL AS DECIMAL(15,2)),
      CAST(dc.so_id AS CHAR(36)), CAST('sales_order' AS CHAR(32)), dc.created_at
    FROM delivery_challans dc
    WHERE dc.institution_id = ? AND dc.customer_id = ?

    UNION ALL

    SELECT ip.id, CAST('payment' AS CHAR(32)),
      CONCAT('Payment - ', si.invoice_number), ip.payment_date,
      CAST('recorded' AS CHAR(32)),
      CAST(ip.amount AS DECIMAL(15,2)), CAST(si.currency AS CHAR(3)),
      CAST(NULL AS DECIMAL(15,2)),
      CAST(si.id AS CHAR(36)), CAST('sales_invoice' AS CHAR(32)), ip.created_at
    FROM invoice_payments ip
    INNER JOIN sales_invoices si ON si.id = ip.invoice_id
    WHERE ip.invoice_type = 'sales' AND ip.institution_id = ? AND si.customer_id = ?
  `;

  const params = [
    institutionId, customerId,
    institutionId, customerId,
    institutionId, customerId,
    institutionId, customerId,
  ];

  const [total, rows] = await Promise.all([
    countUnion(unionSql, params),
    fetchUnionPage(unionSql, params, limit, offset),
  ]);

  return {
    transactions: rows.map(mapRow),
    pagination: { total, limit, offset },
  };
}

async function getVendorTransactionHistory(institutionId, vendorId, options = {}) {
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);

  const unionSql = `
    SELECT po.id AS reference_id, CAST('purchase_order' AS CHAR(32)) AS transaction_type,
      po.po_number AS document_number, po.order_date AS transaction_date,
      CAST(po.status AS CHAR(32)) AS status,
      CAST(po.total_amount AS DECIMAL(15,2)) AS amount,
      CAST(po.currency AS CHAR(3)) AS currency,
      CAST(NULL AS DECIMAL(15,2)) AS balance_amount,
      CAST(NULL AS CHAR(36)) AS related_id,
      CAST(NULL AS CHAR(32)) AS related_type,
      po.created_at AS sort_at
    FROM purchase_orders po
    WHERE po.institution_id = ? AND po.vendor_id = ?

    UNION ALL

    SELECT pi.id, CAST('purchase_invoice' AS CHAR(32)), pi.invoice_number, pi.invoice_date,
      CAST(pi.status AS CHAR(32)),
      CAST(pi.total_amount AS DECIMAL(15,2)), CAST(pi.currency AS CHAR(3)),
      CAST(pi.balance_amount AS DECIMAL(15,2)),
      CAST(pi.po_id AS CHAR(36)), CAST('purchase_order' AS CHAR(32)), pi.created_at
    FROM purchase_invoices pi
    WHERE pi.institution_id = ? AND pi.vendor_id = ?

    UNION ALL

    SELECT grn.id, CAST('grn' AS CHAR(32)), grn.grn_number, grn.receipt_date,
      CAST(grn.status AS CHAR(32)),
      CAST(po.total_amount AS DECIMAL(15,2)), CAST(po.currency AS CHAR(3)),
      CAST(NULL AS DECIMAL(15,2)),
      CAST(po.id AS CHAR(36)), CAST('purchase_order' AS CHAR(32)), grn.created_at
    FROM goods_receipt_notes grn
    INNER JOIN purchase_orders po ON po.id = grn.po_id
    WHERE grn.institution_id = ? AND po.vendor_id = ?

    UNION ALL

    SELECT pr.id, CAST('purchase_return' AS CHAR(32)), pr.return_number, pr.return_date,
      CAST(pr.status AS CHAR(32)),
      CAST(pr.total_amount AS DECIMAL(15,2)), CAST(NULL AS CHAR(3)),
      CAST(NULL AS DECIMAL(15,2)),
      CAST(pr.po_id AS CHAR(36)), CAST('purchase_order' AS CHAR(32)), pr.created_at
    FROM purchase_returns pr
    WHERE pr.institution_id = ? AND pr.vendor_id = ?

    UNION ALL

    SELECT ip.id, CAST('payment' AS CHAR(32)),
      CONCAT('Payment - ', pi.invoice_number), ip.payment_date,
      CAST('recorded' AS CHAR(32)),
      CAST(ip.amount AS DECIMAL(15,2)), CAST(pi.currency AS CHAR(3)),
      CAST(NULL AS DECIMAL(15,2)),
      CAST(pi.id AS CHAR(36)), CAST('purchase_invoice' AS CHAR(32)), ip.created_at
    FROM invoice_payments ip
    INNER JOIN purchase_invoices pi ON pi.id = ip.invoice_id
    WHERE ip.invoice_type = 'purchase' AND ip.institution_id = ? AND pi.vendor_id = ?
  `;

  const params = [
    institutionId, vendorId,
    institutionId, vendorId,
    institutionId, vendorId,
    institutionId, vendorId,
    institutionId, vendorId,
  ];

  const [total, rows] = await Promise.all([
    countUnion(unionSql, params),
    fetchUnionPage(unionSql, params, limit, offset),
  ]);

  return {
    transactions: rows.map(mapRow),
    pagination: { total, limit, offset },
  };
}

module.exports = {
  getCustomerTransactionHistory,
  getVendorTransactionHistory,
};
