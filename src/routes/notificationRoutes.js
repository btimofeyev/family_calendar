const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getNotifications, markAllAsRead, markAsRead } = require('../controllers/notificationController');

router.use(authMiddleware);

router.get('/', getNotifications);
router.post('/read-all', markAllAsRead);
//router.post('/mark-as-read', markAsRead);
module.exports = router;