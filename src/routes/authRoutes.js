const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/register-invited', authController.registerInvited);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);


router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
