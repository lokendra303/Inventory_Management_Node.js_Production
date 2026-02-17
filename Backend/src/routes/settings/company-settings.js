const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const companySettingsController = require('../../controllers/settings/companySettingsController');
const { requireRole } = require('../../middleware/auth');

// Restrict all company settings routes to admin and super_admin
router.use(requireRole(['admin', 'super_admin']));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { fileType } = req.params;
    const uploadDir = path.join(__dirname, `../../uploads/company/${fileType}s`);
    
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

router.get('/', companySettingsController.getSettings);
router.put('/', companySettingsController.updateSettings);
router.post('/upload/:fileType', upload.single('file'), companySettingsController.uploadFile);
router.delete('/upload/:fileType', companySettingsController.deleteFile);

module.exports = router;
