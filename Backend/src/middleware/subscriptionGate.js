const subscriptionService = require('../modules/subscription/subscription.service');
const logger = require('../utils/logger');

/**
 * Middleware factory — checks a resource limit before allowing create/reactivate operations.
 * Blocks POST (create) and PUT/PATCH when body sets status='active' (reactivation).
 */
const checkLimit = (resource) => async (req, res, next) => {
  const isCreate     = req.method === 'POST';
  const isReactivate = (req.method === 'PUT' || req.method === 'PATCH')
                       && req.body?.status === 'active';

  if (!isCreate && !isReactivate) return next();

  try {
    await subscriptionService.checkLimit(req.institutionId, resource);
    next();
  } catch (error) {
    logger.warn('Subscription limit reached', { institutionId: req.institutionId, resource, error: error.message });
    return res.status(403).json({ success: false, error: error.message, code: 'SUBSCRIPTION_LIMIT' });
  }
};

/**
 * Middleware factory — checks a feature is available on the current plan.
 * Usage: router.get('/', checkFeature('price_lists'), controller.getAll)
 */
const checkFeature = (feature) => async (req, res, next) => {
  try {
    await subscriptionService.checkFeature(req.institutionId, feature);
    next();
  } catch (error) {
    logger.warn('Subscription feature blocked', { institutionId: req.institutionId, feature, error: error.message });
    return res.status(403).json({ success: false, error: error.message, code: 'SUBSCRIPTION_FEATURE' });
  }
};

module.exports = { checkLimit, checkFeature };
