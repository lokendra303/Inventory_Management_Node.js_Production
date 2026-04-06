const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/roles', require('./role.routes'));
router.use('/service-accounts', require('./serviceAccount.routes'));

module.exports = {
  router,
  middleware: require('./auth.middleware'),
  authService: require('./auth.service'),
  roleService: require('./role.service'),
  serviceAccountService: require('./serviceAccount.service'),
  authController: require('./auth.controller'),
  roleController: require('./role.controller'),
};
