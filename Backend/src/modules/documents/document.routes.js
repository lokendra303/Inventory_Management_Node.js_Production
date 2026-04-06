const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentController = require('./document.controller');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { institutionId } = req;
    const uploadDir = path.join(__dirname, `../../../uploads/documents/${institutionId}/temp`);
    
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

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/folders', documentController.createFolder);
router.get('/folders', documentController.getFolders);
router.put('/folders/:folderId/toggle', documentController.toggleFolderStatus);
router.delete('/folders/:folderId', documentController.deleteFolder);

router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.get('/', documentController.getDocuments);
router.delete('/:documentId', documentController.deleteDocument);

module.exports = router;
