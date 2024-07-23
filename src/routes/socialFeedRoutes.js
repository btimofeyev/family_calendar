const express = require('express');
const router = express.Router();
const socialFeedController = require('../controllers/socialFeedController');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/imageUpload');

router.use(authMiddleware);

router.get('/posts', socialFeedController.getPosts);
router.post('/posts', upload.single('photo'), socialFeedController.createPost);
router.post('/posts/:postId/like', socialFeedController.toggleLike);
router.post('/posts/:postId/comment', socialFeedController.addComment);
router.get('/posts/:postId/comments', socialFeedController.getComments);

module.exports = router;