const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const companySettingsController = require('./companySettings.controller');
const { requireRole, auditLog } = require('../auth/auth.middleware');

// Restrict all company settings routes to admin and super_admin
router.use(requireRole(['admin', 'super_admin']));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { fileType } = req.params;
    const uploadDir = path.join(__dirname, `../../../uploads/company/${fileType}s`);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const { institutionId } = req;
    const ext = path.extname(file.originalname);
    const filename = `${institutionId}_${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg)'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

router.get('/', companySettingsController.getSettings.bind(companySettingsController));
router.put('/', auditLog('company_settings_updated'), companySettingsController.updateSettings.bind(companySettingsController));
router.post('/upload/:fileType', auditLog('company_settings_file_uploaded'), upload.single('file'), companySettingsController.uploadFile.bind(companySettingsController));
router.delete('/upload/:fileType', auditLog('company_settings_file_deleted'), companySettingsController.deleteFile.bind(companySettingsController));

router.post('/addresses', auditLog('company_address_created'), companySettingsController.addAddress.bind(companySettingsController));
router.put('/addresses/:id', auditLog('company_address_updated'), companySettingsController.updateAddress.bind(companySettingsController));
router.delete('/addresses/:id', auditLog('company_address_deleted'), companySettingsController.deleteAddress.bind(companySettingsController));

router.patch('/stamps/:id', auditLog('company_stamp_updated'), companySettingsController.patchStamp.bind(companySettingsController));
router.delete('/stamps/:id', auditLog('company_stamp_deleted'), companySettingsController.deleteStamp.bind(companySettingsController));
router.patch('/signatures/:id', auditLog('company_signature_updated'), companySettingsController.patchSignature.bind(companySettingsController));
router.delete('/signatures/:id', auditLog('company_signature_deleted'), companySettingsController.deleteSignature.bind(companySettingsController));

module.exports = router;
