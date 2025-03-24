const pool = require("../config/db");
const { getIo } = require('../middleware/socket'); 
const webpush = require('web-push');
const { getUserPushSubscriptions, removeInvalidSubscription } = require('../models/subscriptionModel');


const NOTIFICATION_TYPES = {
  like: 'New Like',
  comment: 'New Comment',
  memory: 'Family Memory',
  event: 'Family Event',
  post: 'New Post',
  invitation: 'Family Invitation',
  mention: 'Mention'
};
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
      // Get user's notification preferences
      const prefsQuery = `SELECT notification_settings FROM users WHERE id = $1`;
      const prefsResult = await pool.query(prefsQuery, [userId]);
      
      let notificationSettings = {};
      if (prefsResult.rows.length > 0 && prefsResult.rows[0].notification_settings) {
        notificationSettings = prefsResult.rows[0].notification_settings;
      }
      
      // Check if user has disabled this notification type
      if (notificationSettings[type] === false) {
        console.log(`User ${userId} has disabled notifications for ${type}`);
        return notification;
      }
      
      const subscriptions = await getUserPushSubscriptions(userId);
      if (subscriptions && subscriptions.length > 0) {
        // Get deep link URL based on notification type
        let url = '/notifications';
        
        if (type === 'like' || type === 'comment' && postId) {
          url = `/feed?highlightPostId=${postId}`;
        } else if (type === 'memory' && memoryId) {
          url = `/memory-detail?memoryId=${memoryId}`;
        } else if (type === 'event' && familyId) {
          url = `/family/${familyId}/calendar`;
        }
        
        // Get notification title based on type
        const title = NOTIFICATION_TYPES[type] || 'New Notification';

        const payload = JSON.stringify({
          title,
          body: content,
          url,
          data: {
            postId,
            commentId,
            familyId,
            memoryId,
            type
          }
        });

        for (const subscription of subscriptions) {
          try {
            await webpush.sendNotification(subscription, payload);
            console.log(`Push notification sent to ${userId} for ${type}`);
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
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;
    
    // Validate preferences object
    const validTypes = ['like', 'comment', 'memory', 'event', 'post', 'invitation', 'mention'];
    for (const [key, value] of Object.entries(preferences)) {
      if (!validTypes.includes(key) || typeof value !== 'boolean') {
        return res.status(400).json({ error: 'Invalid notification preferences format' });
      }
    }
    
    // Update preferences in the database
    const query = `
      UPDATE users
      SET notification_settings = $1
      WHERE id = $2
      RETURNING id
    `;
    
    await pool.query(query, [preferences, userId]);
    
    res.json({ 
      message: 'Notification preferences updated successfully',
      preferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
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
