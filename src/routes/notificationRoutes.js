const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/:id/read', notificationController.markAsRead);
// Add this new route
router.post('/push/subscribe', notificationController.subscribePush);
router.put('/preferences', notificationController.updateNotificationPreferences);

module.exports = router;