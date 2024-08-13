const express = require("express");
const router = express.Router();
const webpush = require("../config/pushconfig"); 
const {
  saveSubscription,
  getUserPushSubscriptions,
} = require("../models/subscriptionModel");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post('/subscribe', async (req, res) => {
    try {
        console.log('Subscribe route hit');
        const userId = req.user.id;
        const subscription = req.body;

        console.log('Received subscription:', JSON.stringify(subscription));
        console.log('User ID:', userId);

        if (!subscription || !subscription.endpoint) {
            throw new Error('Invalid subscription object');
        }

        await saveSubscription(userId, subscription);
        console.log('Subscription saved successfully');
        res.status(201).json({ message: 'Subscription saved' });
    } catch (error) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ error: 'Failed to save subscription', details: error.message });
    }
});
router.post("/test-notification", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const subscriptions = await getUserPushSubscriptions(userId);
    if (!subscriptions || subscriptions.length === 0) {
      return res
        .status(404)
        .json({ error: "No push subscriptions found for this user" });
    }

    const payload = JSON.stringify({
      title: "Test Notification",
      body: "This is a test notification.",
      url: "/dashboard.html", // Adjust this URL as needed
    });

    subscriptions.forEach((subscription) => {
      webpush.sendNotification(subscription, payload).catch((error) => {
        console.error("Error sending push notification:", error);
      });
    });

    res.status(200).json({ message: "Test notification sent" });
  } catch (error) {
    console.error("Error triggering test notification:", error);
    res.status(500).json({ error: "Failed to trigger test notification" });
  }
});

module.exports = router;
