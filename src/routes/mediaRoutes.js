// src/routes/mediaRoutes.js
const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get a presigned URL for direct upload to R2
router.post('/presigned-upload', mediaController.getPresignedUploadUrl);

// Confirm a successful upload
router.post('/confirm-upload', mediaController.confirmUpload);

// Cancel an upload
router.post('/cancel-upload', mediaController.cancelUpload);

// Add uploaded media to a memory
router.post('/memories/:memoryId/media', mediaController.addMediaToMemory);

module.exports = router;