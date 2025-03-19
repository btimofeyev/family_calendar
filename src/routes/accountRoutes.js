// src/routes/accountRoutes.js
const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes (require authentication)
router.post('/request-deletion', authMiddleware, accountController.requestAccountDeletion);
router.post('/cancel-deletion', authMiddleware, accountController.cancelAccountDeletion);
router.get('/deletion-status', authMiddleware, accountController.checkDeletionStatus);

// Public route (no auth required)
router.post('/confirm-deletion', accountController.confirmAccountDeletion);

module.exports = router;