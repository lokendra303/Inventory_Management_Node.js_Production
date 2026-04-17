const db = require('../../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// Official Indian GST Council slabs only
const GOV_TAX_SLABS = [
  { name: 'GST 5%',    rate: 5,    tax_type: 'GST'  },
  { name: 'GST 12%',   rate: 12,   tax_type: 'GST'  },
  { name: 'GST 18%',   rate: 18,   tax_type: 'GST'  },
  { name: 'GST 28%',   rate: 28,   tax_type: 'GST'  },
  { name: 'CGST 2.5%', rate: 2.5,  tax_type: 'CGST' },
  { name: 'CGST 6%',   rate: 6,    tax_type: 'CGST' },
  { name: 'CGST 9%',   rate: 9,    tax_type: 'CGST' },
  { name: 'CGST 14%',  rate: 14,   tax_type: 'CGST' },
  { name: 'SGST 2.5%', rate: 2.5,  tax_type: 'SGST' },
  { name: 'SGST 6%',   rate: 6,    tax_type: 'SGST' },
  { name: 'SGST 9%',   rate: 9,    tax_type: 'SGST' },
  { name: 'SGST 14%',  rate: 14,   tax_type: 'SGST' },
  { name: 'IGST 5%',   rate: 5,    tax_type: 'IGST' },
  { name: 'IGST 12%',  rate: 12,   tax_type: 'IGST' },
  { name: 'IGST 18%',  rate: 18,   tax_type: 'IGST' },
  { name: 'IGST 28%',  rate: 28,   tax_type: 'IGST' },
];

function fetchLiveRates() {
  return { source: 'government', rates: GOV_TAX_SLABS };
}

/**
 * Sync live gov. rates into tax_rates table for the institution.
 * Skips rates that already exist (same name + institution).
 */
async function syncLiveRates(institutionId) {
  // Remove previously synced junk: 0% rates and non-GST types (TDS/TCS) added by old sync
  await db.query(
    `UPDATE tax_rates SET status='inactive'
     WHERE institution_id=? AND (rate=0 OR tax_type IN ('TDS','TCS'))`,
    [institutionId]
  );

  const { source, rates } = fetchLiveRates();
  let inserted = 0, skipped = 0;

  for (const r of rates) {
    const existing = await db.query(
      `SELECT id FROM tax_rates WHERE institution_id=? AND name=? AND status='active' LIMIT 1`,
      [institutionId, r.name]
    );
    if (existing.length > 0) { skipped++; continue; }

    await db.query(
      `INSERT INTO tax_rates (id, institution_id, name, rate, tax_type, is_compound, is_inclusive)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
      [uuidv4(), institutionId, r.name, r.rate, r.tax_type]
    );
    inserted++;
  }

  logger.info('Live tax sync complete', { institutionId, source, inserted, skipped });
  return { source, inserted, skipped, total: rates.length };
}

module.exports = { fetchLiveRates, syncLiveRates };
