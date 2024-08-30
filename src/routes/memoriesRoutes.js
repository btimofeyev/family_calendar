const express = require('express');
const router = express.Router();
const memoriesController = require('../controllers/memoriesController');
const authMiddleware = require('../middleware/authMiddleware');
const { upload } = require('../middleware/imageUpload');

router.use(authMiddleware);

router.post('/create', memoriesController.createMemory);
router.get('/:familyId', memoriesController.getMemories);
router.post('/:memoryId/content', upload.single('content'), memoriesController.addContentToMemory);
router.post('/:memoryId/comment', memoriesController.addCommentToMemory);
router.get('/:memoryId/content', memoriesController.getMemoryContent);
router.get('/:memoryId/comments', memoriesController.getMemoryComments);
router.delete('/:memoryId', memoriesController.deleteMemory);

module.exports = router;