// src/routes/socialFeedRoutes.js 
const express = require('express');
const router = express.Router();
const socialFeedController = require('../controllers/socialFeedController');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/imageUpload');

router.use(authMiddleware);

// Keep the existing routes
router.get('/family/:familyId/posts', socialFeedController.getPosts);
router.post('/family/:familyId/posts', upload.array('media', 4), socialFeedController.createPost);
router.put('/posts/:postId', socialFeedController.updatePost);

// Add new route for creating posts with already uploaded media
router.post('/family/:familyId/posts/with-media', socialFeedController.createPostWithMedia);

router.post('/posts/:postId/like', socialFeedController.toggleLike);
router.post('/posts/:postId/comment', socialFeedController.addComment);
router.get('/posts/:postId/comments', socialFeedController.getComments);
router.delete('/posts/:postId', socialFeedController.deletePost);
router.get('/link-preview', socialFeedController.getLinkPreview);

module.exports = router;