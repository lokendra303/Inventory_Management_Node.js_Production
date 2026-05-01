const db = require('../../database/connection');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');
const multi = require('./companySettingsMulti.service');
const { resolveUploadAbsolutePath } = require('../../shared/storage/fileStorage');

class CompanySettingsController {
  async getInstitutionProfile(institutionId) {
    const [profile] = await db.query(
      'SELECT * FROM institution_profiles WHERE institution_id = ?',
      [institutionId]
    );
    return profile || null;
  }

  async upsertInstitutionProfile(institutionId, payload) {
    const [existing] = await db.query(
      'SELECT id FROM institution_profiles WHERE institution_id = ?',
      [institutionId]
    );

    const values = [
      payload.companyName ?? null,
      payload.address ?? null,
      payload.phone ?? null,
      payload.email ?? null,
      payload.bankName ?? null,
      payload.accountNumber ?? null,
      payload.ifscCode ?? null,
      payload.swiftCode ?? null,
      payload.authorizedSignatoryName ?? null,
      payload.authorizedSignatoryDesignation ?? null,
      institutionId,
    ];

    if (existing) {
      await db.query(
        `UPDATE institution_profiles
         SET company_name = ?, address = ?, phone = ?, email = ?, bank_name = ?, account_number = ?, ifsc_code = ?, swift_code = ?, authorized_signatory_name = ?, authorized_signatory_designation = ?
         WHERE institution_id = ?`,
        values
      );
      return;
    }

    await db.query(
      `INSERT INTO institution_profiles
       (company_name, address, phone, email, bank_name, account_number, ifsc_code, swift_code, authorized_signatory_name, authorized_signatory_designation, institution_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  }

  async getSettings(req, res) {
    try {
      const { institutionId } = req;

      await multi.ensureTables();
      await multi.migrateLegacyRows(institutionId);

      const profile = await this.getInstitutionProfile(institutionId);

      const profileFirst = {
        company_name: profile?.company_name ?? null,
        address: profile?.address ?? null,
        phone: profile?.phone ?? null,
        email: profile?.email ?? null,
        bank_name: profile?.bank_name ?? null,
        account_number: profile?.account_number ?? null,
        ifsc_code: profile?.ifsc_code ?? null,
        swift_code: profile?.swift_code ?? null,
        logo_path: profile?.logo_path ?? null,
        authorized_signatory_name: profile?.authorized_signatory_name ?? null,
        authorized_signatory_designation: profile?.authorized_signatory_designation ?? null,
      };

      const data = await multi.attachMultiToSettingsRow(institutionId, profileFirst);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error fetching company settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch company settings',
      });
    }
  }

  async updateSettings(req, res) {
    try {
      const { institutionId } = req;
      const b = req.body;

      const profile = await this.getInstitutionProfile(institutionId);
      const pf = profile || {};

      const companyName = b.companyName !== undefined ? b.companyName : pf.company_name;
      const address = b.address !== undefined ? b.address : pf.address;
      const phone = b.phone !== undefined ? b.phone : pf.phone;
      const email = b.email !== undefined ? b.email : pf.email;
      const bankName = b.bankName !== undefined ? b.bankName : pf.bank_name;
      const accountNumber = b.accountNumber !== undefined ? b.accountNumber : pf.account_number;
      const ifscCode = b.ifscCode !== undefined ? b.ifscCode : pf.ifsc_code;
      const swiftCode = b.swiftCode !== undefined ? b.swiftCode : pf.swift_code;
      const authorizedSignatoryName = b.authorizedSignatoryName !== undefined ? b.authorizedSignatoryName : pf.authorized_signatory_name;
      const authorizedSignatoryDesignation = b.authorizedSignatoryDesignation !== undefined ? b.authorizedSignatoryDesignation : pf.authorized_signatory_designation;

      await this.upsertInstitutionProfile(institutionId, {
        companyName,
        address,
        phone,
        email,
        bankName,
        accountNumber,
        ifscCode,
        swiftCode,
        authorizedSignatoryName,
        authorizedSignatoryDesignation,
      });

      const addressPayload = {
        address,
        address_line1: b.addressLine1 ?? b.address_line1,
        address_line2: b.addressLine2 ?? b.address_line2,
        city: b.city,
        state: b.state,
        country: b.country,
        postal_code: b.postalCode ?? b.postal_code,
      };
      const hasStructuredAddressInput = Object.values(addressPayload).some((v) => v !== undefined && v !== null);
      if (hasStructuredAddressInput) {
        await multi.upsertDefaultAddressFields(institutionId, addressPayload);
      }
      await multi.syncLegacyMirror(institutionId);

      if (companyName && companyName.trim()) {
        await db.query(
          'UPDATE institutions SET name = ?, updated_at = NOW() WHERE id = ?',
          [companyName.trim(), institutionId]
        );
      }

      res.json({
        success: true,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      logger.error('Error updating company settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update company settings',
      });
    }
  }

  async uploadFile(req, res) {
    try {
      const { institutionId } = req;
      const { fileType } = req.params;

      if (!['logo', 'stamp', 'signature'].includes(fileType)) {
        return res.status(400).json({ success: false, error: 'Invalid file type' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const filePath = `/uploads/company/${fileType}s/${req.file.filename}`;
      const label = (req.body && req.body.label) ? String(req.body.label).trim() : '';

      if (fileType === 'stamp') {
        await multi.ensureTables();
        const id = await multi.addStamp(institutionId, filePath, label || 'Stamp');
        await multi.syncLegacyMirror(institutionId);
        return res.json({
          success: true,
          message: 'Stamp uploaded',
          data: { id, path: filePath },
        });
      }

      if (fileType === 'signature') {
        await multi.ensureTables();
        const id = await multi.addSignature(institutionId, filePath, label || 'Signature');
        await multi.syncLegacyMirror(institutionId);
        return res.json({
          success: true,
          message: 'Signature uploaded',
          data: { id, path: filePath },
        });
      }

      const columnName = `${fileType}_path`;
      const [existing] = await db.query(
        'SELECT id FROM institution_profiles WHERE institution_id = ?',
        [institutionId]
      );

      if (existing) {
        await db.query(`UPDATE institution_profiles SET ${columnName} = ? WHERE institution_id = ?`, [filePath, institutionId]);
      } else {
        await db.query(
          `INSERT INTO institution_profiles (institution_id, ${columnName}) VALUES (?, ?)`,
          [institutionId, filePath]
        );
      }

      res.json({
        success: true,
        message: `${fileType} uploaded successfully`,
        data: { path: filePath },
      });
    } catch (error) {
      logger.error('Error uploading file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload file',
      });
    }
  }

  async deleteFile(req, res) {
    try {
      const { institutionId } = req;
      const { fileType } = req.params;

      if (!['logo', 'stamp', 'signature'].includes(fileType)) {
        return res.status(400).json({ success: false, error: 'Invalid file type' });
      }

      if (fileType === 'stamp' || fileType === 'signature') {
        await multi.ensureTables();
        const docs = await db.query(
          `SELECT id FROM institution_documents
           WHERE institution_id = ? AND doc_type = ? AND is_default = 1
           ORDER BY sort_order ASC, created_at ASC`,
          [institutionId, fileType]
        );
        if (docs.length) {
          if (fileType === 'stamp') await multi.deleteStamp(institutionId, docs[0].id);
          else await multi.deleteSignature(institutionId, docs[0].id);
        }
        await multi.syncLegacyMirror(institutionId);
        return res.json({ success: true, message: `${fileType} deleted successfully` });
      }

      const columnName = `${fileType}_path`;
      const [settings] = await db.query(
        `SELECT ${columnName} FROM institution_profiles WHERE institution_id = ?`,
        [institutionId]
      );

      if (settings && settings[columnName]) {
        const fp = resolveUploadAbsolutePath(path.join(__dirname, '../..'), settings[columnName]);
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
        }
      }

      await db.query(
        `UPDATE institution_profiles SET ${columnName} = NULL WHERE institution_id = ?`,
        [institutionId]
      );

      res.json({
        success: true,
        message: `${fileType} deleted successfully`,
      });
    } catch (error) {
      logger.error('Error deleting file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file',
      });
    }
  }

  async addAddress(req, res) {
    try {
      const { institutionId } = req;
      const id = await multi.addAddress(institutionId, req.body);
      res.locals.auditExtra = { submitted: req.body, createdId: id };
      res.json({ success: true, data: { id } });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async updateAddress(req, res) {
    try {
      const { institutionId } = req;
      const beforeRows = await db.query(
        `SELECT id, label, address, address_line1, address_line2, city, state, country, postal_code, is_default
         FROM institution_addresses WHERE id = ? AND institution_id = ?`,
        [req.params.id, institutionId]
      );
      const before = beforeRows[0] || null;
      res.locals.auditExtra = { before, submitted: req.body };
      await multi.updateAddress(institutionId, req.params.id, req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async deleteAddress(req, res) {
    try {
      const { institutionId } = req;
      const rows = await db.query(
        `SELECT id, label, address, address_line1, address_line2, city, state, country, postal_code, is_default
         FROM institution_addresses WHERE id = ? AND institution_id = ?`,
        [req.params.id, institutionId]
      );
      res.locals.auditExtra = { deleted: rows[0] || null };
      await multi.deleteAddress(institutionId, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async patchStamp(req, res) {
    try {
      const { institutionId } = req;
      await multi.updateStamp(institutionId, req.params.id, req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async deleteStamp(req, res) {
    try {
      const { institutionId } = req;
      await multi.deleteStamp(institutionId, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async patchSignature(req, res) {
    try {
      const { institutionId } = req;
      await multi.updateSignature(institutionId, req.params.id, req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async deleteSignature(req, res) {
    try {
      const { institutionId } = req;
      await multi.deleteSignature(institutionId, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }
}

module.exports = new CompanySettingsController();
