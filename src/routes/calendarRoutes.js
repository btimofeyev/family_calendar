const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const auth = require('../middleware/auth');

router.post('/events', auth, calendarController.createEvent);
router.get('/events', auth, calendarController.getEvents);
router.put('/events/:id', auth, calendarController.updateEvent);
router.delete('/events/:id', auth, calendarController.deleteEvent);

module.exports = router;