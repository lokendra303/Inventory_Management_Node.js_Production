const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const { resolveUploadAbsolutePath } = require('../../shared/storage/fileStorage');

let tablesReady = false;
const ADDR_TABLE = 'institution_addresses';

async function ensureTables() {
  if (tablesReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS institution_addresses (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      label VARCHAR(120) NOT NULL DEFAULT 'Address',
      address TEXT NOT NULL,
      address_line1 VARCHAR(255) NULL,
      address_line2 VARCHAR(255) NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      country VARCHAR(100) NULL,
      postal_code VARCHAR(20) NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_inst_addr_inst (institution_id),
      KEY idx_inst_addr_default (institution_id, is_default),
      KEY idx_inst_addr_sort (institution_id, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS institution_documents (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      doc_type VARCHAR(30) NOT NULL,
      label VARCHAR(120) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      metadata JSON DEFAULT NULL,
      KEY idx_inst_docs_type (institution_id, doc_type),
      KEY idx_inst_docs_default (institution_id, doc_type, is_default),
      KEY idx_inst_docs_sort (institution_id, doc_type, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS institution_profiles (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      institution_id VARCHAR(36) NOT NULL,
      company_name VARCHAR(255) NULL,
      address TEXT NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      bank_name VARCHAR(255) NULL,
      account_number VARCHAR(100) NULL,
      ifsc_code VARCHAR(50) NULL,
      swift_code VARCHAR(50) NULL,
      logo_path VARCHAR(500) NULL,
      authorized_signatory_name VARCHAR(255) NULL,
      authorized_signatory_designation VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_inst_profile (institution_id),
      KEY idx_inst_profile_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tablesReady = true;
}

async function migrateLegacyRows(institutionId) {
  await ensureTables();

  const [addrCnt] = await db.query(
    'SELECT COUNT(*) AS c FROM institution_addresses WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(addrCnt?.c || 0) === 0) {
    const [institution] = await db.query(
      'SELECT address, city, state, country, postal_code FROM institutions WHERE id = ?',
      [institutionId]
    );
    const fallbackAddress = institution?.address;
    if (fallbackAddress && String(fallbackAddress).trim()) {
      await db.query(
        `INSERT INTO institution_addresses
         (id, institution_id, label, address, address_line1, city, state, country, postal_code, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [
          uuidv4(),
          institutionId,
          'Registered office',
          String(fallbackAddress).trim(),
          String(fallbackAddress).trim(),
          institution?.city || null,
          institution?.state || null,
          institution?.country || null,
          institution?.postal_code || null,
        ]
      );
    }
  }
}

async function listAddresses(institutionId) {
  await ensureTables();
  await migrateLegacyRows(institutionId);

  const rows = await db.query(
    `SELECT id, label, address, address_line1, address_line2, city, state, country, postal_code, is_default, sort_order, created_at
     FROM institution_addresses WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
  return rows;
}

async function listDocsByType(institutionId, type) {
  await ensureTables();
  await migrateLegacyRows(institutionId);
  return db.query(
    `SELECT id, label, file_path, is_default, sort_order, created_at
     FROM institution_documents
     WHERE institution_id = ? AND doc_type = ?
     ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId, type]
  );
}

async function listStamps(institutionId) {
  return listDocsByType(institutionId, 'stamp');
}

async function listSignatures(institutionId) {
  return listDocsByType(institutionId, 'signature');
}

async function clearDefaults(institutionId, table) {
  await db.query(`UPDATE ${table} SET is_default = 0 WHERE institution_id = ?`, [institutionId]);
}

async function syncLegacyMirror(institutionId) {
  const [da] = await db.query(
    `SELECT address, city, state, country, postal_code
     FROM institution_addresses WHERE institution_id = ? AND is_default = 1 LIMIT 1`,
    [institutionId]
  );
  const [ds] = await db.query(
    `SELECT file_path FROM institution_documents
     WHERE institution_id = ? AND doc_type = 'stamp' AND is_default = 1 LIMIT 1`,
    [institutionId]
  );
  const [dg] = await db.query(
    `SELECT file_path FROM institution_documents
     WHERE institution_id = ? AND doc_type = 'signature' AND is_default = 1 LIMIT 1`,
    [institutionId]
  );

  if (da?.address) {
    await db.query(
      `UPDATE institutions
       SET address = ?, city = ?, state = ?, country = ?, postal_code = ?, updated_at = NOW()
       WHERE id = ?`,
      [da.address, da.city || null, da.state || null, da.country || null, da.postal_code || null, institutionId]
    );
  }
}

async function addAddress(institutionId, { label, address, address_line1, address_line2, city, state, country, postal_code, is_default }) {
  await ensureTables();
  const id = uuidv4();
  const lab = (label || 'Address').trim().slice(0, 120);
  const addr = (address || '').trim();
  if (!addr) throw new Error('Address text is required');

  const def = !!is_default;
  if (def) await clearDefaults(institutionId, ADDR_TABLE);

  const [maxRow] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM institution_addresses WHERE institution_id = ?',
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);

  await db.query(
    `INSERT INTO institution_addresses
     (id, institution_id, label, address, address_line1, address_line2, city, state, country, postal_code, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      institutionId,
      lab,
      addr,
      address_line1 !== undefined ? String(address_line1).trim() || null : null,
      address_line2 !== undefined ? String(address_line2).trim() || null : null,
      city !== undefined ? String(city).trim() || null : null,
      state !== undefined ? String(state).trim() || null : null,
      country !== undefined ? String(country).trim() || null : null,
      postal_code !== undefined ? String(postal_code).trim() || null : null,
      def ? 1 : 0,
      sort
    ]
  );

  if (!def) {
    const [c] = await db.query(
      'SELECT COUNT(*) AS c FROM institution_addresses WHERE institution_id = ? AND is_default = 1',
      [institutionId]
    );
    if (Number(c?.c || 0) === 0) {
      await db.query(
        'UPDATE institution_addresses SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [id, institutionId]
      );
    }
  }

  await syncLegacyMirror(institutionId);
  return id;
}

async function updateAddress(institutionId, addressId, { label, address, address_line1, address_line2, city, state, country, postal_code, is_default }) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT id FROM institution_addresses WHERE id = ? AND institution_id = ?',
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
  if (address_line1 !== undefined) {
    updates.push('address_line1 = ?');
    vals.push(String(address_line1).trim() || null);
  }
  if (address_line2 !== undefined) {
    updates.push('address_line2 = ?');
    vals.push(String(address_line2).trim() || null);
  }
  if (city !== undefined) {
    updates.push('city = ?');
    vals.push(String(city).trim() || null);
  }
  if (state !== undefined) {
    updates.push('state = ?');
    vals.push(String(state).trim() || null);
  }
  if (country !== undefined) {
    updates.push('country = ?');
    vals.push(String(country).trim() || null);
  }
  if (postal_code !== undefined) {
    updates.push('postal_code = ?');
    vals.push(String(postal_code).trim() || null);
  }
  if (is_default !== undefined && is_default) {
    await clearDefaults(institutionId, ADDR_TABLE);
    updates.push('is_default = 1');
  } else if (is_default === false) {
    updates.push('is_default = 0');
  }

  if (updates.length === 0) throw new Error('Nothing to update');
  vals.push(addressId, institutionId);
  await db.query(
    `UPDATE institution_addresses SET ${updates.join(', ')} WHERE id = ? AND institution_id = ?`,
    vals
  );

  const [defCount] = await db.query(
    'SELECT COUNT(*) AS c FROM institution_addresses WHERE institution_id = ? AND is_default = 1',
    [institutionId]
  );
  if (Number(defCount?.c || 0) === 0) {
    const [first] = await db.query(
      'SELECT id FROM institution_addresses WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE institution_addresses SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }

  await syncLegacyMirror(institutionId);
}

async function deleteAddress(institutionId, addressId) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT is_default FROM institution_addresses WHERE id = ? AND institution_id = ?',
    [addressId, institutionId]
  );
  if (!row) throw new Error('Address not found');

  await db.query('DELETE FROM institution_addresses WHERE id = ? AND institution_id = ?', [addressId, institutionId]);

  if (row.is_default) {
    const [first] = await db.query(
      'SELECT id FROM institution_addresses WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE institution_addresses SET is_default = 1 WHERE id = ? AND institution_id = ?',
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
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
     FROM institution_documents
     WHERE institution_id = ? AND doc_type = 'stamp'`,
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);

  const [c] = await db.query(
    `SELECT COUNT(*) AS c FROM institution_documents
     WHERE institution_id = ? AND doc_type = 'stamp'`,
    [institutionId]
  );
  const isFirst = Number(c?.c || 0) === 0;
  if (isFirst) {
    await db.query(
      `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order)
       VALUES (?, ?, 'stamp', ?, ?, 1, ?)`,
      [id, institutionId, lab, filePath, sort]
    );
  } else {
    await db.query(
      `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order)
       VALUES (?, ?, 'stamp', ?, ?, 0, ?)`,
      [id, institutionId, lab, filePath, sort]
    );
  }

  await syncLegacyMirror(institutionId);
  return id;
}

async function updateStamp(institutionId, stampId, { label, is_default }) {
  await ensureTables();
  const [row] = await db.query(
    `SELECT id FROM institution_documents
     WHERE id = ? AND institution_id = ? AND doc_type = 'stamp'`,
    [stampId, institutionId]
  );
  if (!row) throw new Error('Stamp not found');

  if (label !== undefined) {
    await db.query(
      `UPDATE institution_documents
       SET label = ?
       WHERE id = ? AND institution_id = ? AND doc_type = 'stamp'`,
      [String(label).trim().slice(0, 120), stampId, institutionId]
    );
  }
  if (is_default) {
    await db.query(
      `UPDATE institution_documents
       SET is_default = 0
       WHERE institution_id = ? AND doc_type = 'stamp'`,
      [institutionId]
    );
    await db.query(
      `UPDATE institution_documents
       SET is_default = 1
       WHERE id = ? AND institution_id = ? AND doc_type = 'stamp'`,
      [stampId, institutionId]
    );
  }
  await syncLegacyMirror(institutionId);
}

async function deleteStamp(institutionId, stampId) {
  await ensureTables();
  const [row] = await db.query(
    `SELECT file_path, is_default FROM institution_documents
     WHERE id = ? AND institution_id = ? AND doc_type = 'stamp'`,
    [stampId, institutionId]
  );
  if (!row) throw new Error('Stamp not found');

  if (row.file_path) {
    const abs = resolveUploadAbsolutePath(path.join(__dirname, '../..'), row.file_path);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); } catch (e) { logger.warn('Stamp file delete', { error: e.message }); }
    }
  }

  await db.query(
    `DELETE FROM institution_documents
     WHERE id = ? AND institution_id = ? AND doc_type = 'stamp'`,
    [stampId, institutionId]
  );

  if (row.is_default) {
    const [first] = await db.query(
      `SELECT id FROM institution_documents
       WHERE institution_id = ? AND doc_type = 'stamp'
       ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
      [institutionId]
    );
    if (first) {
      await db.query(
        `UPDATE institution_documents
         SET is_default = 1
         WHERE id = ? AND institution_id = ? AND doc_type = 'stamp'`,
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
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
     FROM institution_documents
     WHERE institution_id = ? AND doc_type = 'signature'`,
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);

  const [c] = await db.query(
    `SELECT COUNT(*) AS c FROM institution_documents
     WHERE institution_id = ? AND doc_type = 'signature'`,
    [institutionId]
  );
  const isFirst = Number(c?.c || 0) === 0;

  await db.query(
    `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order)
     VALUES (?, ?, 'signature', ?, ?, ?, ?)`,
    [id, institutionId, lab, filePath, isFirst ? 1 : 0, sort]
  );

  await syncLegacyMirror(institutionId);
  return id;
}

async function updateSignature(institutionId, sigId, { label, is_default }) {
  await ensureTables();
  const [row] = await db.query(
    `SELECT id FROM institution_documents
     WHERE id = ? AND institution_id = ? AND doc_type = 'signature'`,
    [sigId, institutionId]
  );
  if (!row) throw new Error('Signature not found');

  if (label !== undefined) {
    await db.query(
      `UPDATE institution_documents
       SET label = ?
       WHERE id = ? AND institution_id = ? AND doc_type = 'signature'`,
      [String(label).trim().slice(0, 120), sigId, institutionId]
    );
  }
  if (is_default) {
    await db.query(
      `UPDATE institution_documents
       SET is_default = 0
       WHERE institution_id = ? AND doc_type = 'signature'`,
      [institutionId]
    );
    await db.query(
      `UPDATE institution_documents
       SET is_default = 1
       WHERE id = ? AND institution_id = ? AND doc_type = 'signature'`,
      [sigId, institutionId]
    );
  }
  await syncLegacyMirror(institutionId);
}

async function deleteSignature(institutionId, sigId) {
  await ensureTables();
  const [row] = await db.query(
    `SELECT file_path, is_default FROM institution_documents
     WHERE id = ? AND institution_id = ? AND doc_type = 'signature'`,
    [sigId, institutionId]
  );
  if (!row) throw new Error('Signature not found');

  if (row.file_path) {
    const abs = resolveUploadAbsolutePath(path.join(__dirname, '../..'), row.file_path);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); } catch (e) { logger.warn('Signature file delete', { error: e.message }); }
    }
  }

  await db.query(
    `DELETE FROM institution_documents
     WHERE id = ? AND institution_id = ? AND doc_type = 'signature'`,
    [sigId, institutionId]
  );

  if (row.is_default) {
    const [first] = await db.query(
      `SELECT id FROM institution_documents
       WHERE institution_id = ? AND doc_type = 'signature'
       ORDER BY sort_order ASC, created_at ASC LIMIT 1`,
      [institutionId]
    );
    if (first) {
      await db.query(
        `UPDATE institution_documents
         SET is_default = 1
         WHERE id = ? AND institution_id = ? AND doc_type = 'signature'`,
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
    address_line1: defAddr?.address_line1 ?? base.address_line1 ?? null,
    address_line2: defAddr?.address_line2 ?? base.address_line2 ?? null,
    city: defAddr?.city ?? base.city ?? null,
    state: defAddr?.state ?? base.state ?? null,
    country: defAddr?.country ?? base.country ?? null,
    postal_code: defAddr?.postal_code ?? base.postal_code ?? null,
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
      'UPDATE institution_addresses SET address = ? WHERE id = ? AND institution_id = ?',
      [text, def.id, institutionId]
    );
  } else {
    await db.query(
      `INSERT INTO institution_addresses
       (id, institution_id, label, address, address_line1, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, 1, 0)`,
      [uuidv4(), institutionId, 'Registered office', text, text]
    );
  }
  await syncLegacyMirror(institutionId);
}

async function upsertDefaultAddressFields(institutionId, payload = {}) {
  await ensureTables();
  const rows = await listAddresses(institutionId);
  const def = rows.find((r) => r.is_default) || rows[0];

  const normalized = {
    address: payload.address !== undefined ? String(payload.address || '').trim() : undefined,
    address_line1: payload.address_line1 !== undefined ? String(payload.address_line1 || '').trim() : undefined,
    address_line2: payload.address_line2 !== undefined ? String(payload.address_line2 || '').trim() : undefined,
    city: payload.city !== undefined ? String(payload.city || '').trim() : undefined,
    state: payload.state !== undefined ? String(payload.state || '').trim() : undefined,
    country: payload.country !== undefined ? String(payload.country || '').trim() : undefined,
    postal_code: payload.postal_code !== undefined ? String(payload.postal_code || '').trim() : undefined,
  };

  if (normalized.address !== undefined && !normalized.address) {
    throw new Error('Address text cannot be empty');
  }

  if (def) {
    const updates = [];
    const vals = [];
    Object.entries(normalized).forEach(([k, v]) => {
      if (v !== undefined) {
        updates.push(`${k} = ?`);
        vals.push(v || null);
      }
    });
    if (updates.length > 0) {
      vals.push(def.id, institutionId);
      await db.query(
        `UPDATE institution_addresses SET ${updates.join(', ')} WHERE id = ? AND institution_id = ?`,
        vals
      );
    }
  } else if (normalized.address) {
    await db.query(
      `INSERT INTO institution_addresses
       (id, institution_id, label, address, address_line1, address_line2, city, state, country, postal_code, is_default, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        uuidv4(),
        institutionId,
        'Registered office',
        normalized.address,
        normalized.address_line1 || normalized.address || null,
        normalized.address_line2 || null,
        normalized.city || null,
        normalized.state || null,
        normalized.country || null,
        normalized.postal_code || null,
      ]
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
  upsertDefaultAddressFields,
  syncLegacyMirror,
};
