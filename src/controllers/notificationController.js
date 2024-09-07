const pool = require("../config/db");
const { getIo } = require('../middleware/socket'); 
const webpush = require('web-push');
const { getUserPushSubscriptions, removeInvalidSubscription } = require('../models/subscriptionModel');


exports.createNotification = async (userId, type, content, postId = null, commentId = null, familyId = null, memoryId = null) => {
  try {
    // Insert the notification into the database
    const query = `
      INSERT INTO notifications (user_id, type, content, post_id, comment_id, family_id, memory_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    const values = [userId, type, content, postId, commentId, familyId, memoryId];
    const { rows } = await pool.query(query, values);

    const notification = rows[0];

    // Emit the notification to the user's room via socket
    const io = getIo();
    io.to(userId.toString()).emit('new_notification', notification);

    // Send a push notification
    try {
      const subscriptions = await getUserPushSubscriptions(userId);
      if (subscriptions && subscriptions.length > 0) {
        const payload = JSON.stringify({
          title: 'New Memory',
          body: content,
          url: '/memories.html'
        });

        for (const subscription of subscriptions) {
          try {
            await webpush.sendNotification(subscription, payload);
          } catch (error) {
            console.error('Error sending push notification:', error);
            if (error.statusCode === 410) {
              await removeInvalidSubscription(userId, subscription.endpoint);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing push notifications:', error);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT n.*, 
             CASE 
               WHEN n.type = 'like' THEN CONCAT(SUBSTRING(n.content FROM 1 FOR POSITION(' liked' IN n.content)), ' liked your post')
               WHEN n.type = 'comment' THEN CONCAT(SUBSTRING(n.content FROM 1 FOR POSITION(' commented' IN n.content)), ' commented on your post')
               WHEN n.type = 'memory' THEN n.content
               ELSE n.content
             END AS formatted_content
      FROM notifications n
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
    `;
    const { rows } = await pool.query(query, [userId]);

    const unreadNotifications = rows.filter(n => !n.read);
    const recentNotifications = rows.slice(0, 10);

    res.json({
      unread: unreadNotifications,
      recent: recentNotifications,
      notifications: rows 
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


  exports.markAllAsRead = async (req, res) => {
    try {
      const userId = req.user.id;
      const query = `
        UPDATE notifications
        SET read = true
        WHERE user_id = $1 AND read = false
        RETURNING *
      `;
      const { rows } = await pool.query(query, [userId]);
      
      // Emit an event to update the client
      const io = getIo();
      io.to(userId.toString()).emit('notifications_read', rows.map(n => n.id));
  
      res.json({ message: 'All notifications marked as read', updatedNotifications: rows });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  exports.markAsRead = async (req, res) => {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;
  
      const query = `
        UPDATE notifications
        SET read = true
        WHERE id = $1 AND user_id = $2 AND read = false
        RETURNING *
      `;
      const { rows } = await pool.query(query, [notificationId, userId]);
  
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Notification not found or already read' });
      }
  
      const updatedNotification = rows[0];
  
      // Emit an event to update the client
      const io = getIo();
      io.to(userId.toString()).emit('notification_read', updatedNotification.id);
  
      res.json({ message: 'Notification marked as read', updatedNotification });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

async function saveSubscription(userId, subscription) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if the endpoint already exists
    const checkQuery = 'SELECT user_id FROM push_subscriptions WHERE endpoint = $1';
    const checkResult = await client.query(checkQuery, [subscription.endpoint]);

    if (checkResult.rows.length > 0 && checkResult.rows[0].user_id !== userId) {
      // Endpoint exists for a different user, delete the old subscription
      const deleteQuery = 'DELETE FROM push_subscriptions WHERE endpoint = $1';
      await client.query(deleteQuery, [subscription.endpoint]);
    }

    // Insert or update the subscription
    const upsertQuery = `
      INSERT INTO push_subscriptions (user_id, endpoint, keys)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, endpoint) DO UPDATE
      SET keys = $3, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      userId,
      subscription.endpoint,
      JSON.stringify({
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh
      })
    ];

    const result = await client.query(upsertQuery, values);
    await client.query('COMMIT');
    console.log('Push subscription saved successfully');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving push subscription:', error);
    throw error;
  } finally {
    client.release();
  }
}

exports.subscribePush = async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;

    // Save the subscription to the database
    const savedSubscription = await saveSubscription(userId, subscription);

    res.status(201).json({ message: 'Subscription added successfully', subscription: savedSubscription });
  } catch (error) {
    console.error('Error in subscribePush:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
