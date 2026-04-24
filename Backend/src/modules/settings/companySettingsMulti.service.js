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

  // Legacy compatibility tables are still used by older endpoints/reports.
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
    'SELECT COUNT(*) AS c FROM institution_addresses WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(addrCnt?.c || 0) === 0) {
    const legacyRows = await db.query(
      `SELECT id, institution_id, label, address, is_default, sort_order, created_at
       FROM company_addresses WHERE institution_id = ?`,
      [institutionId]
    );
    if (legacyRows.length) {
      for (const row of legacyRows) {
        await db.query(
          `INSERT INTO institution_addresses (id, institution_id, label, address, is_default, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
           ON DUPLICATE KEY UPDATE
             label = VALUES(label),
             address = VALUES(address),
             is_default = VALUES(is_default),
             sort_order = VALUES(sort_order)`,
          [row.id, row.institution_id, row.label, row.address, row.is_default ? 1 : 0, row.sort_order || 0, row.created_at || null]
        );
      }
    } else {
      const [institution] = await db.query(
        'SELECT address FROM institutions WHERE id = ?',
        [institutionId]
      );
      const [cs] = await db.query(
        'SELECT address FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );
      const fallbackAddress = institution?.address || cs?.address;
      if (fallbackAddress && String(fallbackAddress).trim()) {
        await db.query(
          `INSERT INTO institution_addresses (id, institution_id, label, address, is_default, sort_order)
           VALUES (?, ?, ?, ?, 1, 0)`,
          [uuidv4(), institutionId, 'Registered office', String(fallbackAddress).trim()]
        );
      }
    }
  }

  const [docCnt] = await db.query(
    'SELECT COUNT(*) AS c FROM institution_documents WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(docCnt?.c || 0) === 0) {
    const legacyStamps = await db.query(
      `SELECT id, institution_id, label, file_path, is_default, sort_order, created_at
       FROM company_stamps WHERE institution_id = ?`,
      [institutionId]
    );
    for (const row of legacyStamps) {
      await db.query(
        `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order, created_at)
         VALUES (?, ?, 'stamp', ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON DUPLICATE KEY UPDATE
           label = VALUES(label),
           file_path = VALUES(file_path),
           is_default = VALUES(is_default),
           sort_order = VALUES(sort_order)`,
        [row.id, row.institution_id, row.label, row.file_path, row.is_default ? 1 : 0, row.sort_order || 0, row.created_at || null]
      );
    }
    const legacySignatures = await db.query(
      `SELECT id, institution_id, label, file_path, is_default, sort_order, created_at
       FROM company_signatures WHERE institution_id = ?`,
      [institutionId]
    );
    for (const row of legacySignatures) {
      await db.query(
        `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order, created_at)
         VALUES (?, ?, 'signature', ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON DUPLICATE KEY UPDATE
           label = VALUES(label),
           file_path = VALUES(file_path),
           is_default = VALUES(is_default),
           sort_order = VALUES(sort_order)`,
        [row.id, row.institution_id, row.label, row.file_path, row.is_default ? 1 : 0, row.sort_order || 0, row.created_at || null]
      );
    }
    const [cs] = await db.query(
      'SELECT logo_path, stamp_path, signature_path FROM company_settings WHERE institution_id = ?',
      [institutionId]
    );
    if (cs?.logo_path) {
      await db.query(
        `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order)
         SELECT ?, ?, 'logo', 'Primary logo', ?, 1, 0
         WHERE NOT EXISTS (
           SELECT 1 FROM institution_documents
           WHERE institution_id = ? AND doc_type = 'logo'
         )`,
        [uuidv4(), institutionId, cs.logo_path, institutionId]
      );
    }
    if (cs?.stamp_path) {
      await db.query(
        `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order)
         SELECT ?, ?, 'stamp', 'Primary stamp', ?, 1, 0
         WHERE NOT EXISTS (
           SELECT 1 FROM institution_documents
           WHERE institution_id = ? AND doc_type = 'stamp'
         )`,
        [uuidv4(), institutionId, cs.stamp_path, institutionId]
      );
    }
    if (cs?.signature_path) {
      await db.query(
        `INSERT INTO institution_documents (id, institution_id, doc_type, label, file_path, is_default, sort_order)
         SELECT ?, ?, 'signature', 'Primary signature', ?, 1, 0
         WHERE NOT EXISTS (
           SELECT 1 FROM institution_documents
           WHERE institution_id = ? AND doc_type = 'signature'
         )`,
        [uuidv4(), institutionId, cs.signature_path, institutionId]
      );
    }
  }
}

async function listAddresses(institutionId) {
  await ensureTables();
  await migrateLegacyRows(institutionId);

  const rows = await db.query(
    `SELECT id, label, address, is_default, sort_order, created_at
     FROM institution_addresses WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
  if (rows.length) return rows;
  return db.query(
    `SELECT id, label, address, is_default, sort_order, created_at
     FROM company_addresses WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
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
  const rows = await listDocsByType(institutionId, 'stamp');
  return rows.length ? rows : db.query(
    `SELECT id, label, file_path, is_default, sort_order, created_at
     FROM company_stamps WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
}

async function listSignatures(institutionId) {
  const rows = await listDocsByType(institutionId, 'signature');
  return rows.length ? rows : db.query(
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
    `SELECT address FROM institution_addresses WHERE institution_id = ? AND is_default = 1 LIMIT 1`,
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

  if (da?.address) {
    await db.query('UPDATE institutions SET address = ?, updated_at = NOW() WHERE id = ?', [da.address, institutionId]);
  }
}

async function addAddress(institutionId, { label, address, is_default }) {
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
    `INSERT INTO institution_addresses (id, institution_id, label, address, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, institutionId, lab, addr, def ? 1 : 0, sort]
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

async function updateAddress(institutionId, addressId, { label, address, is_default }) {
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
      `INSERT INTO institution_addresses (id, institution_id, label, address, is_default, sort_order)
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
