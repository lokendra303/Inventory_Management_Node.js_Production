const express = require('express');
const { requireAuth, validateInstitutionConsistency } = require('../middleware/auth');
const moduleRegistry = require('../core/modules/moduleRegistry');
const errorMiddleware = require('../core/http/errorMiddleware');
const notFoundMiddleware = require('../core/http/notFoundMiddleware');

const router = express.Router();

// Protected routes — auth required below this line
// Note: public barcode routes are mounted once on the app at /api/barcode in server.js
router.use(requireAuth);
router.use(validateInstitutionConsistency);

// Resource routes via registry (modular monolith composition root)
moduleRegistry.forEach(({ path, router: moduleRouter }) => {
  router.use(path, moduleRouter);
});

router.use(errorMiddleware);
router.use('*', notFoundMiddleware);

module.exports = router;