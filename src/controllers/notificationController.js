const pool = require("../config/db");
const { getIo } = require('../middleware/socket'); 
const webpush = require('web-push');
const { getUserPushSubscriptions } = require('../models/subscriptionModel'); // Example model

exports.createNotification = async (userId, type, content) => {
  try {
    const query = `
      INSERT INTO notifications (user_id, type, content, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    const values = [userId, type, content];
    const { rows } = await pool.query(query, values);

    const notification = rows[0];

    // Emit the notification to the user's room
    const io = getIo();
    io.to(userId.toString()).emit('new_notification', notification);

    // Send a push notification
    const subscriptions = await getUserPushSubscriptions(userId);
    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: 'New Notification',
        body: notification.content,
        url: '/dashboard.html'
      });

      subscriptions.forEach(subscription => {
        webpush.sendNotification(subscription, payload).catch(error => {
          console.error('Error sending push notification:', error);
        });
      });
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
        recent: recentNotifications
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