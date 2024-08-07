const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');

router.get('/check/:token', invitationController.checkInvitation);
router.post('/invite', invitationController.inviteMember); // This now includes authMiddleware
router.get('/accept/:token', invitationController.acceptInvitation);
router.get('/decline/:token', invitationController.declineInvitation);

module.exports = router;