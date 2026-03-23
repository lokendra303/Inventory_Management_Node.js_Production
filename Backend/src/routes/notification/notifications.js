const express = require('express');
const ctrl = require('../../controllers/notification/notificationController');
const router = express.Router();

router.get('/',           ctrl.getNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.put('/:notificationId/read', ctrl.markRead);
router.put('/mark-all-read', ctrl.markAllRead);

module.exports = router;
