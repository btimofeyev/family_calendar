const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const calendarController = require('../controllers/calendarController');
const familyController = require('../controllers/familyController');
const invitationController = require('../controllers/invitationController');

const authMiddleware = require('../middleware/authMiddleware');


// Apply auth middleware to all routes
router.use(authMiddleware);

// Dashboard routes
router.get('/profile', dashboardController.getUserProfile);
router.get('/calendar', dashboardController.getFamilyCalendar);

// Calendar routes
router.post('/calendar', calendarController.createEvent);
router.get('/calendar', calendarController.getEvents);
router.put('/calendar/:id', calendarController.updateEvent);
router.delete('/calendar/:id', calendarController.deleteEvent);

// Family routes
router.post('/families', familyController.createFamily);
router.post('/family/member', familyController.addFamilyMember);
router.get('/family/members', familyController.getFamilyMembers);

//Family Invites


router.post('/family/invite', invitationController.inviteMember);
router.get('/invite/accept/:token', invitationController.acceptInvitation);
router.get('/invite/decline/:token', invitationController.declineInvitation);

module.exports = router;