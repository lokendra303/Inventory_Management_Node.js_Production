const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../../database/connection');
const logger = require('../../utils/logger');

let tablesReady = false;

async function ensureTables() {
  if (tablesReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS company_addresses (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      label VARCHAR(120) NOT NULL DEFAULT 'Address',
      address TEXT NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_company_addr_inst (institution_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS company_stamps (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      label VARCHAR(120) NOT NULL DEFAULT 'Stamp',
      file_path VARCHAR(500) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_company_stamp_inst (institution_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS company_signatures (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      label VARCHAR(120) NOT NULL DEFAULT 'Signature',
      file_path VARCHAR(500) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_company_sig_inst (institution_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tablesReady = true;
}

async function migrateLegacyRows(institutionId) {
  await ensureTables();

  const [addrCnt] = await db.query(
    'SELECT COUNT(*) AS c FROM company_addresses WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(addrCnt?.c || 0) === 0) {
    const [cs] = await db.query(
      'SELECT address FROM company_settings WHERE institution_id = ?',
      [institutionId]
    );
    if (cs?.address && String(cs.address).trim()) {
      await db.query(
        `INSERT INTO company_addresses (id, institution_id, label, address, is_default, sort_order)
         VALUES (?, ?, ?, ?, 1, 0)`,
        [uuidv4(), institutionId, 'Registered office', String(cs.address).trim()]
      );
    }
  }

  const [stCnt] = await db.query(
    'SELECT COUNT(*) AS c FROM company_stamps WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(stCnt?.c || 0) === 0) {
    const [cs] = await db.query(
      'SELECT stamp_path FROM company_settings WHERE institution_id = ?',
      [institutionId]
    );
    if (cs?.stamp_path) {
      await db.query(
        `INSERT INTO company_stamps (id, institution_id, label, file_path, is_default, sort_order)
         VALUES (?, ?, ?, ?, 1, 0)`,
        [uuidv4(), institutionId, 'Primary stamp', cs.stamp_path]
      );
    }
  }

  const [sigCnt] = await db.query(
    'SELECT COUNT(*) AS c FROM company_signatures WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(sigCnt?.c || 0) === 0) {
    const [cs] = await db.query(
      'SELECT signature_path FROM company_settings WHERE institution_id = ?',
      [institutionId]
    );
    if (cs?.signature_path) {
      await db.query(
        `INSERT INTO company_signatures (id, institution_id, label, file_path, is_default, sort_order)
         VALUES (?, ?, ?, ?, 1, 0)`,
        [uuidv4(), institutionId, 'Primary signature', cs.signature_path]
      );
    }
  }
}

async function listAddresses(institutionId) {
  await ensureTables();
  return db.query(
    `SELECT id, label, address, is_default, sort_order, created_at
     FROM company_addresses WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
}

async function listStamps(institutionId) {
  await ensureTables();
  return db.query(
    `SELECT id, label, file_path, is_default, sort_order, created_at
     FROM company_stamps WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
}

async function listSignatures(institutionId) {
  await ensureTables();
  return db.query(
    `SELECT id, label, file_path, is_default, sort_order, created_at
     FROM company_signatures WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
}

async function clearDefaults(institutionId, table) {
  await db.query(`UPDATE ${table} SET is_default = 0 WHERE institution_id = ?`, [institutionId]);
}

async function syncLegacyMirror(institutionId) {
  const [da] = await db.query(
    `SELECT address FROM company_addresses WHERE institution_id = ? AND is_default = 1 LIMIT 1`,
    [institutionId]
  );
  const [ds] = await db.query(
    `SELECT file_path FROM company_stamps WHERE institution_id = ? AND is_default = 1 LIMIT 1`,
    [institutionId]
  );
  const [dg] = await db.query(
    `SELECT file_path FROM company_signatures WHERE institution_id = ? AND is_default = 1 LIMIT 1`,
    [institutionId]
  );

  const [exists] = await db.query('SELECT id FROM company_settings WHERE institution_id = ?', [institutionId]);
  if (exists) {
    await db.query(
      `UPDATE company_settings SET
         address = COALESCE(?, address),
         stamp_path = ?,
         signature_path = ?
       WHERE institution_id = ?`,
      [da?.address ?? null, ds?.file_path ?? null, dg?.file_path ?? null, institutionId]
    );
  }
}

async function addAddress(institutionId, { label, address, is_default }) {
  await ensureTables();
  const id = uuidv4();
  const lab = (label || 'Address').trim().slice(0, 120);
  const addr = (address || '').trim();
  if (!addr) throw new Error('Address text is required');

  const def = !!is_default;
  if (def) await clearDefaults(institutionId, 'company_addresses');

  const [maxRow] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM company_addresses WHERE institution_id = ?',
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);

  await db.query(
    `INSERT INTO company_addresses (id, institution_id, label, address, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, institutionId, lab, addr, def ? 1 : 0, sort]
  );

  if (!def) {
    const [c] = await db.query(
      'SELECT COUNT(*) AS c FROM company_addresses WHERE institution_id = ? AND is_default = 1',
      [institutionId]
    );
    if (Number(c?.c || 0) === 0) {
      await db.query(
        'UPDATE company_addresses SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [id, institutionId]
      );
    }
  }

  await syncLegacyMirror(institutionId);
  return id;
}

async function updateAddress(institutionId, addressId, { label, address, is_default }) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT id FROM company_addresses WHERE id = ? AND institution_id = ?',
    [addressId, institutionId]
  );
  if (!row) throw new Error('Address not found');

  const updates = [];
  const vals = [];
  if (label !== undefined) {
    updates.push('label = ?');
    vals.push(String(label).trim().slice(0, 120));
  }
  if (address !== undefined) {
    const a = String(address).trim();
    if (!a) throw new Error('Address text cannot be empty');
    updates.push('address = ?');
    vals.push(a);
  }
  if (is_default !== undefined && is_default) {
    await clearDefaults(institutionId, 'company_addresses');
    updates.push('is_default = 1');
  } else if (is_default === false) {
    updates.push('is_default = 0');
  }

  if (updates.length === 0) throw new Error('Nothing to update');
  vals.push(addressId, institutionId);
  await db.query(
    `UPDATE company_addresses SET ${updates.join(', ')} WHERE id = ? AND institution_id = ?`,
    vals
  );

  const [defCount] = await db.query(
    'SELECT COUNT(*) AS c FROM company_addresses WHERE institution_id = ? AND is_default = 1',
    [institutionId]
  );
  if (Number(defCount?.c || 0) === 0) {
    const [first] = await db.query(
      'SELECT id FROM company_addresses WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE company_addresses SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }

  await syncLegacyMirror(institutionId);
}

async function deleteAddress(institutionId, addressId) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT is_default FROM company_addresses WHERE id = ? AND institution_id = ?',
    [addressId, institutionId]
  );
  if (!row) throw new Error('Address not found');

  await db.query('DELETE FROM company_addresses WHERE id = ? AND institution_id = ?', [addressId, institutionId]);

  if (row.is_default) {
    const [first] = await db.query(
      'SELECT id FROM company_addresses WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE company_addresses SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }
  await syncLegacyMirror(institutionId);
}

async function addStamp(institutionId, filePath, label) {
  await ensureTables();
  const id = uuidv4();
  const lab = (label || 'Stamp').trim().slice(0, 120);

  const [maxRow] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM company_stamps WHERE institution_id = ?',
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);

  const [c] = await db.query(
    'SELECT COUNT(*) AS c FROM company_stamps WHERE institution_id = ?',
    [institutionId]
  );
  const isFirst = Number(c?.c || 0) === 0;
  if (isFirst) {
    await db.query(
      `INSERT INTO company_stamps (id, institution_id, label, file_path, is_default, sort_order)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [id, institutionId, lab, filePath, sort]
    );
  } else {
    await db.query(
      `INSERT INTO company_stamps (id, institution_id, label, file_path, is_default, sort_order)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, institutionId, lab, filePath, sort]
    );
  }

  await syncLegacyMirror(institutionId);
  return id;
}

async function updateStamp(institutionId, stampId, { label, is_default }) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT id FROM company_stamps WHERE id = ? AND institution_id = ?',
    [stampId, institutionId]
  );
  if (!row) throw new Error('Stamp not found');

  if (label !== undefined) {
    await db.query(
      'UPDATE company_stamps SET label = ? WHERE id = ? AND institution_id = ?',
      [String(label).trim().slice(0, 120), stampId, institutionId]
    );
  }
  if (is_default) {
    await clearDefaults(institutionId, 'company_stamps');
    await db.query(
      'UPDATE company_stamps SET is_default = 1 WHERE id = ? AND institution_id = ?',
      [stampId, institutionId]
    );
  }
  await syncLegacyMirror(institutionId);
}

async function deleteStamp(institutionId, stampId) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT file_path, is_default FROM company_stamps WHERE id = ? AND institution_id = ?',
    [stampId, institutionId]
  );
  if (!row) throw new Error('Stamp not found');

  if (row.file_path) {
    const rel = row.file_path.startsWith('/') ? row.file_path.slice(1) : row.file_path;
    const abs = path.join(__dirname, '..', '..', rel);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); } catch (e) { logger.warn('Stamp file delete', { error: e.message }); }
    }
  }

  await db.query('DELETE FROM company_stamps WHERE id = ? AND institution_id = ?', [stampId, institutionId]);

  if (row.is_default) {
    const [first] = await db.query(
      'SELECT id FROM company_stamps WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE company_stamps SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }
  await syncLegacyMirror(institutionId);
}

async function addSignature(institutionId, filePath, label) {
  await ensureTables();
  const id = uuidv4();
  const lab = (label || 'Signature').trim().slice(0, 120);

  const [maxRow] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM company_signatures WHERE institution_id = ?',
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);

  const [c] = await db.query(
    'SELECT COUNT(*) AS c FROM company_signatures WHERE institution_id = ?',
    [institutionId]
  );
  const isFirst = Number(c?.c || 0) === 0;

  await db.query(
    `INSERT INTO company_signatures (id, institution_id, label, file_path, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, institutionId, lab, filePath, isFirst ? 1 : 0, sort]
  );

  await syncLegacyMirror(institutionId);
  return id;
}

async function updateSignature(institutionId, sigId, { label, is_default }) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT id FROM company_signatures WHERE id = ? AND institution_id = ?',
    [sigId, institutionId]
  );
  if (!row) throw new Error('Signature not found');

  if (label !== undefined) {
    await db.query(
      'UPDATE company_signatures SET label = ? WHERE id = ? AND institution_id = ?',
      [String(label).trim().slice(0, 120), sigId, institutionId]
    );
  }
  if (is_default) {
    await clearDefaults(institutionId, 'company_signatures');
    await db.query(
      'UPDATE company_signatures SET is_default = 1 WHERE id = ? AND institution_id = ?',
      [sigId, institutionId]
    );
  }
  await syncLegacyMirror(institutionId);
}

async function deleteSignature(institutionId, sigId) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT file_path, is_default FROM company_signatures WHERE id = ? AND institution_id = ?',
    [sigId, institutionId]
  );
  if (!row) throw new Error('Signature not found');

  if (row.file_path) {
    const rel = row.file_path.startsWith('/') ? row.file_path.slice(1) : row.file_path;
    const abs = path.join(__dirname, '..', '..', rel);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); } catch (e) { logger.warn('Signature file delete', { error: e.message }); }
    }
  }

  await db.query('DELETE FROM company_signatures WHERE id = ? AND institution_id = ?', [sigId, institutionId]);

  if (row.is_default) {
    const [first] = await db.query(
      'SELECT id FROM company_signatures WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE company_signatures SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }
  await syncLegacyMirror(institutionId);
}

/** Merge multi-rows into legacy fields for PDFs and older clients */
async function attachMultiToSettingsRow(institutionId, settingsRow) {
  await migrateLegacyRows(institutionId);

  const addresses = await listAddresses(institutionId);
  const stamps = await listStamps(institutionId);
  const signatures = await listSignatures(institutionId);

  const base = settingsRow && typeof settingsRow === 'object' ? settingsRow : {};

  const defAddr = addresses.find((a) => a.is_default) || addresses[0];
  const defSt = stamps.find((s) => s.is_default) || stamps[0];
  const defSig = signatures.find((s) => s.is_default) || signatures[0];

  return {
    ...base,
    addresses,
    stamps,
    signatures,
    address: defAddr?.address ?? base.address ?? '',
    stamp_path: defSt?.file_path ?? base.stamp_path ?? null,
    signature_path: defSig?.file_path ?? base.signature_path ?? null,
  };
}

async function upsertDefaultAddressText(institutionId, addressText) {
  await ensureTables();
  const text = (addressText || '').trim();
  if (!text) return;

  const rows = await listAddresses(institutionId);
  const def = rows.find((r) => r.is_default) || rows[0];

  if (def) {
    await db.query(
      'UPDATE company_addresses SET address = ? WHERE id = ? AND institution_id = ?',
      [text, def.id, institutionId]
    );
  } else {
    await db.query(
      `INSERT INTO company_addresses (id, institution_id, label, address, is_default, sort_order)
       VALUES (?, ?, ?, ?, 1, 0)`,
      [uuidv4(), institutionId, 'Registered office', text]
    );
  }
  await syncLegacyMirror(institutionId);
}

module.exports = {
  ensureTables,
  migrateLegacyRows,
  attachMultiToSettingsRow,
  listAddresses,
  listStamps,
  listSignatures,
  addAddress,
  updateAddress,
  deleteAddress,
  addStamp,
  updateStamp,
  deleteStamp,
  addSignature,
  updateSignature,
  deleteSignature,
  upsertDefaultAddressText,
  syncLegacyMirror,
};
