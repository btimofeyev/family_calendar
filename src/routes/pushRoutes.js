const express = require('express');
const router = express.Router();
const { saveSubscription } = require('../models/subscriptionModel');

const authMiddleware = require('../middleware/authMiddleware');
router.use(authMiddleware);


router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;

    await saveSubscription(userId, subscription);
    res.status(201).json({ message: 'Subscription saved' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

module.exports = router;
