const db = require('../../database/connection');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

class CompanySettingsController {
  async getSettings(req, res) {
    try {
      const { institutionId } = req;

      const [settings] = await db.query(
        'SELECT * FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );

      res.json({
        success: true,
        data: settings || {}
      });
    } catch (error) {
      logger.error('Error fetching company settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch company settings'
      });
    }
  }

  async updateSettings(req, res) {
    try {
      const { institutionId, user } = req;
      const { companyName, address, phone, email, bankName, accountNumber, ifscCode, swiftCode, authorizedSignatoryName, authorizedSignatoryDesignation } = req.body;

      const [existing] = await db.query(
        'SELECT id FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );

      if (existing) {
        await db.query(
          `UPDATE company_settings 
           SET company_name = ?, address = ?, phone = ?, email = ?, bank_name = ?, account_number = ?, ifsc_code = ?, swift_code = ?, authorized_signatory_name = ?, authorized_signatory_designation = ?
           WHERE institution_id = ?`,
          [companyName, address, phone, email, bankName, accountNumber, ifscCode, swiftCode, authorizedSignatoryName, authorizedSignatoryDesignation, institutionId]
        );
      } else {
        await db.query(
          `INSERT INTO company_settings (institution_id, company_name, address, phone, email, bank_name, account_number, ifsc_code, swift_code, authorized_signatory_name, authorized_signatory_designation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [institutionId, companyName, address, phone, email, bankName, accountNumber, ifscCode, swiftCode, authorizedSignatoryName, authorizedSignatoryDesignation]
        );
      }

      res.json({
        success: true,
        message: 'Settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating company settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update company settings'
      });
    }
  }

  async uploadFile(req, res) {
    try {
      const { institutionId } = req;
      const { fileType } = req.params;

      console.log('Upload request:', { institutionId, fileType, file: req.file });

      if (!['logo', 'stamp', 'signature'].includes(fileType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const filePath = `/uploads/company/${fileType}s/${req.file.filename}`;
      const columnName = `${fileType}_path`;

      const [existing] = await db.query(
        'SELECT id FROM company_settings WHERE institution_id = ?',
        [institutionId]
      );

      console.log('Existing record:', existing);

      if (existing) {
        const updateQuery = `UPDATE company_settings SET ${columnName} = ? WHERE institution_id = ?`;
        console.log('Update query:', updateQuery, [filePath, institutionId]);
        await db.query(updateQuery, [filePath, institutionId]);
      } else {
        await db.query(
          `INSERT INTO company_settings (institution_id, ${columnName}) VALUES (?, ?)`,
          [institutionId, filePath]
        );
      }

      res.json({
        success: true,
        message: `${fileType} uploaded successfully`,
        data: { path: filePath }
      });
    } catch (error) {
      logger.error('Error uploading file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload file'
      });
    }
  }

  async deleteFile(req, res) {
    try {
      const { institutionId } = req;
      const { fileType } = req.params;

      if (!['logo', 'stamp', 'signature'].includes(fileType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file type'
        });
      }

      const columnName = `${fileType}_path`;

      const [settings] = await db.query(
        `SELECT ${columnName} FROM company_settings WHERE institution_id = ?`,
        [institutionId]
      );

      if (settings && settings[columnName]) {
        const filePath = path.join(__dirname, '../../', settings[columnName]);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await db.query(
        `UPDATE company_settings SET ${columnName} = NULL WHERE institution_id = ?`,
        [institutionId]
      );

      res.json({
        success: true,
        message: `${fileType} deleted successfully`
      });
    } catch (error) {
      logger.error('Error deleting file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
  }
}

module.exports = new CompanySettingsController();

