// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.post('/read-all', notificationController.markAllAsRead);
router.post('/:id/read', notificationController.markAsRead);
router.post('/push/subscribe', notificationController.subscribePush);
router.get('/preferences', notificationController.getNotificationPreferences);
router.put('/preferences', notificationController.updateNotificationPreferences);
router.post('/test-push', notificationController.sendTestPushNotification);

module.exports = router;