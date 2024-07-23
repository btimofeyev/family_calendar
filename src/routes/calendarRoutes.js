/*const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/events', authMiddleware, calendarController.createEvent);
router.get('/events', authMiddleware, calendarController.getEvents);
router.put('/events/:id', authMiddleware, calendarController.updateEvent);
router.delete('/events/:id', authMiddleware, calendarController.deleteEvent);

module.exports = router;*/