// src/controllers/notificationController.js
const pool = require("../config/db");
const { getIo } = require('../middleware/socket'); 
// Remove webpush and import Expo SDK instead
const { Expo } = require('expo-server-sdk');

// Initialize Expo SDK
const expo = new Expo();

// Keep your notification types
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
      console.log(`Attempting to send push notification to user ${userId} for ${type} notification`);
      
      // Get user's notification preferences
      const prefsQuery = `SELECT notification_settings FROM users WHERE id = $1`;
      const prefsResult = await pool.query(prefsQuery, [userId]);
      
      let notificationSettings = {};
      if (prefsResult.rows.length > 0 && prefsResult.rows[0].notification_settings) {
        notificationSettings = prefsResult.rows[0].notification_settings;
        console.log(`User ${userId} notification preferences:`, notificationSettings);
      } else {
        console.log(`No notification preferences found for user ${userId}, using defaults`);
      }
      
      // Check if user has disabled this notification type
      if (notificationSettings[type] === false) {
        console.log(`User ${userId} has disabled notifications for ${type}`);
        return notification;
      }
      
      // Get deep link URL based on notification type
      let url = '/notifications';
      
      if ((type === 'like' || type === 'comment') && postId) {
        url = `/feed?highlightPostId=${postId}`;
      } else if (type === 'memory' && memoryId) {
        url = `/memory-detail?memoryId=${memoryId}`;
      } else if (type === 'event' && familyId) {
        url = `/family/${familyId}/calendar`;
      } else if (type === 'post' && postId) {
        url = `/feed?highlightPostId=${postId}`;
      }
      
      // Get push tokens for this user
      const tokensQuery = `
        SELECT token FROM push_tokens 
        WHERE user_id = $1 AND is_valid = true
      `;
      const tokensResult = await pool.query(tokensQuery, [userId]);
      const pushTokens = tokensResult.rows.map(row => row.token);
      
      if (pushTokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return notification;
      }
      
      // Get notification title based on type
      const title = NOTIFICATION_TYPES[type] || 'New Notification';

      // Create the notification payload
      const messages = [];
      
      // Filter for valid Expo push tokens
      for (let pushToken of pushTokens) {
        // Check if this is a valid Expo push token
        if (!Expo.isExpoPushToken(pushToken)) {
          console.log(`${pushToken} is not a valid Expo push token`);
          continue;
        }
        
        // Create a message
        messages.push({
          to: pushToken,
          sound: 'default',
          title: title,
          body: content,
          data: {
            postId,
            commentId,
            familyId,
            memoryId,
            type,
            url
          },
        });
      }
      
      console.log(`Prepared ${messages.length} push notifications to send`);
      
      // Send the notifications with Expo
      if (messages.length > 0) {
        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];
        
        for (let chunk of chunks) {
          try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log('Push notification ticket chunk:', ticketChunk);
            tickets.push(...ticketChunk);
          } catch (error) {
            console.error('Error sending push notification chunk:', error);
          }
        }
        
        // Handle ticket receipts - in a real app, you'd want to store these and check receipts later
        console.log('Push notification tickets:', tickets);
        
        // Process tickets to handle errors and update token validity
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const token = messages[i]?.to;
          
          if (ticket.status === 'error') {
            console.error(`Error sending push notification to ${token}:`, ticket.message);
            
            // If the token is invalid or expired, mark it as invalid in database
            if (
              ticket.details?.error === 'DeviceNotRegistered' || 
              ticket.details?.error === 'InvalidCredentials'
            ) {
              try {
                const updateQuery = `
                  UPDATE push_tokens 
                  SET is_valid = false, updated_at = NOW() 
                  WHERE token = $1
                `;
                await pool.query(updateQuery, [token]);
                console.log(`Marked token ${token} as invalid`);
              } catch (dbError) {
                console.error('Error updating token validity:', dbError);
              }
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

// Other controller methods remain the same...
exports.getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's notification settings from database
    const query = `SELECT notification_settings FROM users WHERE id = $1`;
    const { rows } = await pool.query(query, [userId]);
    
    // Default preferences in case nothing is stored yet
    let preferences = {
      like: true,
      comment: true,
      memory: true,
      event: true,
      post: true,
      invitation: true,
      mention: true
    };
    
    // If user has preferences stored, use those
    if (rows.length > 0 && rows[0].notification_settings) {
      preferences = rows[0].notification_settings;
    }
    
    res.json({ 
      preferences 
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Update to store Expo push tokens instead of web push subscriptions
exports.subscribePush = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Push token registration request:', {
      userId,
      body: req.body,
      token: req.body.token || req.body.pushToken || 'not found'
    });
    const pushToken = req.body.token || req.body.pushToken || req.body.expoPushToken;

    if (!pushToken) {
      return res.status(400).json({ error: 'Push token is required' });
    }

    // Validate that this is a proper Expo push token
    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({ error: 'Invalid Expo push token format' });
    }

    // Save the token to the database
    const query = `
      INSERT INTO push_tokens (user_id, token, is_valid)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, token) 
      DO UPDATE SET updated_at = NOW(), is_valid = true
      RETURNING id
    `;
    
    const result = await pool.query(query, [userId, pushToken]);
    
    console.log(`Push token stored for user ${userId}`);
    
    res.status(201).json({ 
      message: 'Push token registered successfully',
      tokenId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error in subscribePush:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};