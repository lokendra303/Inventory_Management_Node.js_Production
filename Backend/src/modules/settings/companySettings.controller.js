const db = require('../../database/connection');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');
const multi = require('./companySettingsMulti.service');

class CompanySettingsController {
  async getSettings(req, res) {
    try {
      const { institutionId } = req;

      await multi.ensureTables();
      await multi.migrateLegacyRows(institutionId);

      const [settings] = await db.query(
        'SELECT * FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );

      const data = await multi.attachMultiToSettingsRow(institutionId, settings || {});

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

      const [prev] = await db.query(
        'SELECT * FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );
      const p = prev || {};

      const companyName = b.companyName !== undefined ? b.companyName : p.company_name;
      const address = b.address !== undefined ? b.address : p.address;
      const phone = b.phone !== undefined ? b.phone : p.phone;
      const email = b.email !== undefined ? b.email : p.email;
      const bankName = b.bankName !== undefined ? b.bankName : p.bank_name;
      const accountNumber = b.accountNumber !== undefined ? b.accountNumber : p.account_number;
      const ifscCode = b.ifscCode !== undefined ? b.ifscCode : p.ifsc_code;
      const swiftCode = b.swiftCode !== undefined ? b.swiftCode : p.swift_code;
      const authorizedSignatoryName = b.authorizedSignatoryName !== undefined ? b.authorizedSignatoryName : p.authorized_signatory_name;
      const authorizedSignatoryDesignation = b.authorizedSignatoryDesignation !== undefined ? b.authorizedSignatoryDesignation : p.authorized_signatory_designation;

      const [existing] = await db.query(
        'SELECT id FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );

      if (existing) {
        await db.query(
          `UPDATE company_settings
           SET company_name = ?, address = ?, phone = ?, email = ?, bank_name = ?, account_number = ?, ifsc_code = ?, swift_code = ?, authorized_signatory_name = ?, authorized_signatory_designation = ?
           WHERE institution_id = ?`,
          [
            companyName, address, phone, email, bankName, accountNumber, ifscCode, swiftCode,
            authorizedSignatoryName, authorizedSignatoryDesignation, institutionId,
          ]
        );
      } else {
        await db.query(
          `INSERT INTO company_settings (institution_id, company_name, address, phone, email, bank_name, account_number, ifsc_code, swift_code, authorized_signatory_name, authorized_signatory_designation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            institutionId, companyName, address, phone, email, bankName, accountNumber, ifscCode, swiftCode,
            authorizedSignatoryName, authorizedSignatoryDesignation,
          ]
        );
      }

      if (address !== undefined && address !== null && String(address).trim()) {
        await multi.upsertDefaultAddressText(institutionId, address);
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
        'SELECT id FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );

      if (existing) {
        await db.query(`UPDATE company_settings SET ${columnName} = ? WHERE institution_id = ?`, [filePath, institutionId]);
      } else {
        await db.query(
          `INSERT INTO company_settings (institution_id, ${columnName}) VALUES (?, ?)`,
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
        const table = fileType === 'stamp' ? 'company_stamps' : 'company_signatures';
        const [settings] = await db.query(
          `SELECT ${fileType}_path FROM company_settings WHERE institution_id = ?`,
          [institutionId]
        );
        const col = `${fileType}_path`;
        const p = settings?.[col];
        if (p) {
          const rows = await db.query(
            `SELECT id FROM ${table} WHERE institution_id = ? AND file_path = ?`,
            [institutionId, p]
          );
          if (rows.length) {
            if (fileType === 'stamp') await multi.deleteStamp(institutionId, rows[0].id);
            else await multi.deleteSignature(institutionId, rows[0].id);
          } else {
            await db.query(`UPDATE company_settings SET ${col} = NULL WHERE institution_id = ?`, [institutionId]);
          }
        }
        await multi.syncLegacyMirror(institutionId);
        return res.json({ success: true, message: `${fileType} deleted successfully` });
      }

      const columnName = `${fileType}_path`;
      const [settings] = await db.query(
        `SELECT ${columnName} FROM company_settings WHERE institution_id = ?`,
        [institutionId]
      );

      if (settings && settings[columnName]) {
        const fp = path.join(__dirname, '../../', settings[columnName]);
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
        }
      }

      await db.query(
        `UPDATE company_settings SET ${columnName} = NULL WHERE institution_id = ?`,
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
      res.json({ success: true, data: { id } });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async updateAddress(req, res) {
    try {
      const { institutionId } = req;
      await multi.updateAddress(institutionId, req.params.id, req.body);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  }

  async deleteAddress(req, res) {
    try {
      const { institutionId } = req;
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
