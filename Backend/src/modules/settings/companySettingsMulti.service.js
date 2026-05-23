const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../../database/connection');
const logger = require('../../utils/logger');
const { resolveUploadAbsolutePath } = require('../../shared/storage/fileStorage');

let tablesReady = false;
const ADDR_TABLE = 'institution_addresses';
const BANK_TABLE = 'institution_bank_accounts';

async function ensureTables() {
  if (tablesReady) return;
  // Schema: migrations (013, 014, 017, etc.) — not created at runtime
  tablesReady = true;
}

async function migrateLegacyBankRows(institutionId) {
  await ensureTables();

  const [bankCnt] = await db.query(
    'SELECT COUNT(*) AS c FROM institution_bank_accounts WHERE institution_id = ?',
    [institutionId]
  );
  if (Number(bankCnt?.c || 0) > 0) return;

  const [profile] = await db.query(
    `SELECT bank_name, account_holder_name, account_number, ifsc_code, branch_name, swift_code
     FROM institution_profiles WHERE institution_id = ? LIMIT 1`,
    [institutionId]
  );
  const p = profile || {};
  const hasBank =
    [p.bank_name, p.account_holder_name, p.account_number, p.ifsc_code, p.branch_name, p.swift_code].some(
      (v) => v != null && String(v).trim() !== ''
    );
  if (!hasBank) return;

  await db.query(
    `INSERT INTO institution_bank_accounts
     (id, institution_id, label, bank_name, account_holder_name, account_number, ifsc_code, branch_name, swift_code, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [
      uuidv4(),
      institutionId,
      'Primary account',
      p.bank_name || null,
      p.account_holder_name || null,
      p.account_number || null,
      p.ifsc_code || null,
      p.branch_name || null,
      p.swift_code || null,
    ]
  );
}

async function migrateLegacyRows(institutionId) {
  await ensureTables();
  await migrateLegacyBankRows(institutionId);

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

async function listBankAccounts(institutionId) {
  await ensureTables();
  await migrateLegacyRows(institutionId);

  return db.query(
    `SELECT id, label, bank_name, account_holder_name, account_number, ifsc_code, branch_name, swift_code, is_default, sort_order, created_at
     FROM institution_bank_accounts WHERE institution_id = ? ORDER BY is_default DESC, sort_order ASC, created_at ASC`,
    [institutionId]
  );
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

async function syncBankLegacyMirror(institutionId) {
  const [dbank] = await db.query(
    `SELECT bank_name, account_holder_name, account_number, ifsc_code, branch_name, swift_code
     FROM institution_bank_accounts WHERE institution_id = ? AND is_default = 1 LIMIT 1`,
    [institutionId]
  );
  if (dbank) {
    await db.query(
      `UPDATE institution_profiles
       SET bank_name = ?, account_holder_name = ?, account_number = ?, ifsc_code = ?, branch_name = ?, swift_code = ?, updated_at = NOW()
       WHERE institution_id = ?`,
      [
        dbank.bank_name || null,
        dbank.account_holder_name || null,
        dbank.account_number || null,
        dbank.ifsc_code || null,
        dbank.branch_name || null,
        dbank.swift_code || null,
        institutionId,
      ]
    );
  }
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
  await syncBankLegacyMirror(institutionId);
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

async function addBankAccount(
  institutionId,
  {
    label,
    bank_name,
    account_holder_name,
    account_number,
    ifsc_code,
    branch_name,
    swift_code,
    is_default,
  }
) {
  await ensureTables();
  const lab = (label || 'Bank account').trim().slice(0, 120);
  const hasDetail = [bank_name, account_holder_name, account_number, ifsc_code, branch_name, swift_code].some(
    (v) => v != null && String(v).trim() !== ''
  );
  if (!hasDetail) throw new Error('Enter at least one bank detail (bank name, account number, etc.)');

  const def = !!is_default;
  if (def) await clearDefaults(institutionId, BANK_TABLE);

  const [maxRow] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM institution_bank_accounts WHERE institution_id = ?',
    [institutionId]
  );
  const sort = Number(maxRow?.n ?? 0);
  const id = uuidv4();

  await db.query(
    `INSERT INTO institution_bank_accounts
     (id, institution_id, label, bank_name, account_holder_name, account_number, ifsc_code, branch_name, swift_code, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      institutionId,
      lab,
      bank_name != null ? String(bank_name).trim() || null : null,
      account_holder_name != null ? String(account_holder_name).trim() || null : null,
      account_number != null ? String(account_number).trim() || null : null,
      ifsc_code != null ? String(ifsc_code).trim() || null : null,
      branch_name != null ? String(branch_name).trim() || null : null,
      swift_code != null ? String(swift_code).trim() || null : null,
      def ? 1 : 0,
      sort,
    ]
  );

  if (!def) {
    const [c] = await db.query(
      'SELECT COUNT(*) AS c FROM institution_bank_accounts WHERE institution_id = ? AND is_default = 1',
      [institutionId]
    );
    if (Number(c?.c || 0) === 0) {
      await db.query(
        'UPDATE institution_bank_accounts SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [id, institutionId]
      );
    }
  }

  await syncBankLegacyMirror(institutionId);
  return id;
}

async function updateBankAccount(
  institutionId,
  bankId,
  {
    label,
    bank_name,
    account_holder_name,
    account_number,
    ifsc_code,
    branch_name,
    swift_code,
    is_default,
  }
) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT id FROM institution_bank_accounts WHERE id = ? AND institution_id = ?',
    [bankId, institutionId]
  );
  if (!row) throw new Error('Bank account not found');

  const updates = [];
  const vals = [];
  const strField = (col, val) => {
    if (val === undefined) return;
    updates.push(`${col} = ?`);
    vals.push(val != null ? String(val).trim() || null : null);
  };

  if (label !== undefined) {
    updates.push('label = ?');
    vals.push(String(label).trim().slice(0, 120));
  }
  strField('bank_name', bank_name);
  strField('account_holder_name', account_holder_name);
  strField('account_number', account_number);
  strField('ifsc_code', ifsc_code);
  strField('branch_name', branch_name);
  strField('swift_code', swift_code);

  if (is_default !== undefined && is_default) {
    await clearDefaults(institutionId, BANK_TABLE);
    updates.push('is_default = 1');
  } else if (is_default === false) {
    updates.push('is_default = 0');
  }

  if (updates.length === 0) throw new Error('Nothing to update');
  vals.push(bankId, institutionId);
  await db.query(
    `UPDATE institution_bank_accounts SET ${updates.join(', ')} WHERE id = ? AND institution_id = ?`,
    vals
  );

  const [defCount] = await db.query(
    'SELECT COUNT(*) AS c FROM institution_bank_accounts WHERE institution_id = ? AND is_default = 1',
    [institutionId]
  );
  if (Number(defCount?.c || 0) === 0) {
    const [first] = await db.query(
      'SELECT id FROM institution_bank_accounts WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE institution_bank_accounts SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }

  await syncBankLegacyMirror(institutionId);
}

async function deleteBankAccount(institutionId, bankId) {
  await ensureTables();
  const [row] = await db.query(
    'SELECT is_default FROM institution_bank_accounts WHERE id = ? AND institution_id = ?',
    [bankId, institutionId]
  );
  if (!row) throw new Error('Bank account not found');

  await db.query('DELETE FROM institution_bank_accounts WHERE id = ? AND institution_id = ?', [bankId, institutionId]);

  if (row.is_default) {
    const [first] = await db.query(
      'SELECT id FROM institution_bank_accounts WHERE institution_id = ? ORDER BY sort_order ASC, created_at ASC LIMIT 1',
      [institutionId]
    );
    if (first) {
      await db.query(
        'UPDATE institution_bank_accounts SET is_default = 1 WHERE id = ? AND institution_id = ?',
        [first.id, institutionId]
      );
    }
  }
  await syncBankLegacyMirror(institutionId);
}

async function upsertDefaultBankFields(institutionId, payload = {}) {
  await ensureTables();
  const rows = await listBankAccounts(institutionId);
  const def = rows.find((r) => r.is_default) || rows[0];

  const normalized = {
    bank_name: payload.bank_name !== undefined ? String(payload.bank_name || '').trim() : undefined,
    account_holder_name:
      payload.account_holder_name !== undefined ? String(payload.account_holder_name || '').trim() : undefined,
    account_number:
      payload.account_number !== undefined ? String(payload.account_number || '').trim() : undefined,
    ifsc_code: payload.ifsc_code !== undefined ? String(payload.ifsc_code || '').trim() : undefined,
    branch_name: payload.branch_name !== undefined ? String(payload.branch_name || '').trim() : undefined,
    swift_code: payload.swift_code !== undefined ? String(payload.swift_code || '').trim() : undefined,
  };

  const hasAny = Object.values(normalized).some((v) => v !== undefined && v);
  if (!hasAny) return;

  if (def) {
    await updateBankAccount(institutionId, def.id, {
      bank_name: normalized.bank_name,
      account_holder_name: normalized.account_holder_name,
      account_number: normalized.account_number,
      ifsc_code: normalized.ifsc_code,
      branch_name: normalized.branch_name,
      swift_code: normalized.swift_code,
    });
  } else {
    await addBankAccount(institutionId, {
      label: 'Primary account',
      bank_name: normalized.bank_name,
      account_holder_name: normalized.account_holder_name,
      account_number: normalized.account_number,
      ifsc_code: normalized.ifsc_code,
      branch_name: normalized.branch_name,
      swift_code: normalized.swift_code,
      is_default: true,
    });
  }
}

/** Merge multi-rows into legacy fields for PDFs and older clients */
async function attachMultiToSettingsRow(institutionId, settingsRow) {
  await migrateLegacyRows(institutionId);

  const addresses = await listAddresses(institutionId);
  const bankAccounts = await listBankAccounts(institutionId);
  const stamps = await listStamps(institutionId);
  const signatures = await listSignatures(institutionId);

  const base = settingsRow && typeof settingsRow === 'object' ? settingsRow : {};

  const defAddr = addresses.find((a) => a.is_default) || addresses[0];
  const defBank = bankAccounts.find((b) => b.is_default) || bankAccounts[0];
  const defSt = stamps.find((s) => s.is_default) || stamps[0];
  const defSig = signatures.find((s) => s.is_default) || signatures[0];

  return {
    ...base,
    addresses,
    bank_accounts: bankAccounts,
    stamps,
    signatures,
    address: defAddr?.address ?? base.address ?? '',
    address_line1: defAddr?.address_line1 ?? base.address_line1 ?? null,
    address_line2: defAddr?.address_line2 ?? base.address_line2 ?? null,
    city: defAddr?.city ?? base.city ?? null,
    state: defAddr?.state ?? base.state ?? null,
    country: defAddr?.country ?? base.country ?? null,
    postal_code: defAddr?.postal_code ?? base.postal_code ?? null,
    bank_name: defBank?.bank_name ?? base.bank_name ?? null,
    account_holder_name: defBank?.account_holder_name ?? base.account_holder_name ?? null,
    account_number: defBank?.account_number ?? base.account_number ?? null,
    ifsc_code: defBank?.ifsc_code ?? base.ifsc_code ?? null,
    branch_name: defBank?.branch_name ?? base.branch_name ?? null,
    swift_code: defBank?.swift_code ?? base.swift_code ?? null,
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
  listBankAccounts,
  listStamps,
  listSignatures,
  addAddress,
  updateAddress,
  deleteAddress,
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
  addStamp,
  updateStamp,
  deleteStamp,
  addSignature,
  updateSignature,
  deleteSignature,
  upsertDefaultAddressText,
  upsertDefaultAddressFields,
  upsertDefaultBankFields,
  syncLegacyMirror,
  syncBankLegacyMirror,
};
