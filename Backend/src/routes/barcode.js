const express = require('express');
const { createSession, pushBarcode, sessionExists, pollSession } = require('../services/barcodeScanService');

const router = express.Router();

// Desktop calls this to get a session ID + QR URL
router.post('/session', (req, res) => {
  const sessionId = createSession();
  res.json({ success: true, sessionId });
});

// Desktop polls until mobile POSTs a barcode (or session expires)
router.get('/poll/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const result = pollSession(sessionId);
  if (!result.ok) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' });
  }
  res.json({ success: true, barcode: result.barcode });
});

// Mobile scanner page POSTs the scanned barcode here
router.post('/scan/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { barcode } = req.body;

  if (!barcode || typeof barcode !== 'string' || barcode.trim().length < 3 || barcode.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Invalid barcode' });
  }

  if (!sessionExists(sessionId)) {
    return res.status(404).json({ success: false, error: 'Session not found or expired' });
  }

  pushBarcode(sessionId, barcode.trim());
  res.json({ success: true, message: 'Barcode received' });
});

module.exports = router;
