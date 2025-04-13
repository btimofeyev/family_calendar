const express = require('express');
const router = express.Router();
const socialFeedController = require('../controllers/socialFeedController');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/imageUpload');

router.use(authMiddleware);

// Updated route to use upload.array instead of upload.single for multiple files
router.get('/family/:familyId/posts', socialFeedController.getPosts);
router.post('/family/:familyId/posts', upload.array('media', 4), socialFeedController.createPost);

router.post('/posts/:postId/like', socialFeedController.toggleLike);
router.post('/posts/:postId/comment', socialFeedController.addComment);
router.get('/posts/:postId/comments', socialFeedController.getComments);
router.delete('/posts/:postId', socialFeedController.deletePost);
router.get('/link-preview', socialFeedController.getLinkPreview);

module.exports = router;