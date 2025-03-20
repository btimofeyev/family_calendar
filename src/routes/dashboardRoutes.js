const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/imageUpload');

const dashboardController = require('../controllers/dashboardController');
const calendarController = require('../controllers/calendarController');
const familyController = require('../controllers/familyController');
const userController = require('../controllers/userController');

const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Dashboard routes
router.get('/profile', dashboardController.getUserProfile);
router.get('/calendar/:familyId', dashboardController.getFamilyCalendar);

// Calendar routes
router.post('/calendar', calendarController.createEvent);
router.get('/calendar', calendarController.getEvents);
router.put('/calendar/:id', calendarController.updateEvent);
router.delete('/calendar/:id', calendarController.deleteEvent);

// Family routes
router.post('/families', familyController.createFamily);
router.post('/families/:familyId/members', familyController.addFamilyMember);
router.get('/families/:familyId/members', familyController.getFamilyMembers);
router.get('/user/families', familyController.getUserFamilies);
router.get('/families/:familyId', familyController.getFamilyDetails); 
router.delete('/families/:familyId/leave', familyController.leaveFamilyGroup);




router.get('/users/:userId', userController.getUserProfile);
router.get('/users/:userId/family/:familyId', userController.getUserProfileInFamily);

// Add these new routes for passkey functionality
router.post('/families/:familyId/passkey', familyController.generateFamilyPasskey);
router.post('/families/validate-passkey', familyController.validatePasskey);

//profile
router.post('/profile/photo', upload.single('profilePhoto'), userController.uploadProfilePhoto);
router.post('/profile/photo/base64', userController.uploadBase64ProfilePhoto);


module.exports = router;