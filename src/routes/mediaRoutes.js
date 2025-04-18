// Updated src/routes/mediaRoutes.js
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

// Add scheduled cleanup route (only for admins/server use)
router.post('/cleanup-pending', (req, res, next) => {
  // Simple check to prevent unauthorized access
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}, mediaController.cleanupPendingUploads);

module.exports = router;