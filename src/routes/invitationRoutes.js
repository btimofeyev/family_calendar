const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');

router.post('/invite', invitationController.inviteMember);
router.get('/check/:token', invitationController.checkInvitation);
router.post('/accept/:token', invitationController.acceptInvitation);
router.get('/decline/:token', invitationController.declineInvitation);

module.exports = router;