// src/controllers/notificationController.js
const pool = require("../config/db");
const { getIo } = require('../middleware/socket'); 
const admin = require('../config/firebase/firebase-admin');
const { Expo } = require('expo-server-sdk');

// Initialize Firebase Admin SDK with your service account credentials
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(require('../config/firebase/firebase-admin'))
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

// Initialize Expo SDK
const expo = new Expo();

// Notification types
const NOTIFICATION_TYPES = {
  like: 'New Like',
  comment: 'New Comment',
  memory: 'Family Memory',
  event: 'Family Event',
  post: 'New Post',
  invitation: 'Family Invitation',
  mention: 'Mention'
};

// Helper function to send push notifications
// Simplified handling to just log a warning for Expo tokens
const sendPushNotification = async (userId, title, body, data) => {
  try {
    // Get user's tokens from database
    const tokensQuery = `
      SELECT token FROM push_tokens 
      WHERE user_id = $1 AND is_valid = true
    `;
    const tokensResult = await pool.query(tokensQuery, [userId]);
    const pushTokens = tokensResult.rows.map(row => row.token);
    
    if (pushTokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return;
    }
    
    // Flag to track if we found any non-Expo tokens
    let foundFcmTokens = false;
    
    // Process each token
    for (const token of pushTokens) {
      if (token.startsWith('ExponentPushToken[')) {
        console.log(`Skipping Expo token ${token} - need production build`);
        // You could log this or notify the developer that users need a production build
        continue;
      }
      
      // Process regular FCM tokens
      foundFcmTokens = true;
      try {
        const message = {
          token: token,
          notification: {
            title: title,
            body: body
          },
          data: data,
          android: {
            priority: 'high'
          }
        };
        
        const response = await admin.messaging().send(message);
        console.log('FCM push sent successfully:', response);
      } catch (tokenError) {
        console.error(`Error sending to token ${token}:`, tokenError);
        
        // Handle invalid tokens
        if (tokenError.code === 'messaging/invalid-argument' || 
            tokenError.code === 'messaging/registration-token-not-registered') {
          try {
            const updateQuery = `UPDATE push_tokens SET is_valid = false WHERE token = $1`;
            await pool.query(updateQuery, [token]);
            console.log(`Marked token ${token} as invalid`);
          } catch (dbError) {
            console.error('Error updating token validity:', dbError);
          }
        }
      }
    }
    
    if (!foundFcmTokens) {
      console.log('No valid FCM tokens found for user - all tokens are Expo development tokens');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { success: false, error: error.message };
  }
};

exports.createNotification = async (userId, type, content, postId = null, commentId = null, familyId = null, memoryId = null) => {
  try {
    console.log(`Creating notification for user ${userId}, type: ${type}, content: ${content}`);
    
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

    // Get notification title based on type
    const title = NOTIFICATION_TYPES[type] || 'New Notification';

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

    // Send push notification with the new function
    await sendPushNotification(
      userId, 
      title, 
      content, 
      { 
        postId,
        commentId,
        familyId,
        memoryId,
        type,
        url
      }
    );

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
    
    res.json({ preferences });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
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

// New function for testing push notifications
exports.sendTestPushNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get the notification title and body from the request or use defaults
    const { title = 'Test Notification', body = 'This is a test notification', data = {} } = req.body;
    
    console.log(`Sending test notification to user ${userId}`);
    
    // Send the push notification
    const results = await sendPushNotification(
      userId,
      title,
      body,
      {
        type: 'test',
        url: '/notifications',
        ...data
      }
    );
    
    res.json({ 
      success: true, 
      message: `Test push notification sent`,
      results
    });
  } catch (error) {
    console.error('Error sending test push notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
};

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

    // Validate token format
    let isExpoToken = false;
    try {
      isExpoToken = Expo.isExpoPushToken(pushToken);
      console.log(`Token validation: isExpoToken = ${isExpoToken}`);
    } catch (error) {
      console.log('Error validating token:', error);
    }

    // Save the token to the database
    const query = `
      INSERT INTO push_tokens (user_id, token, is_valid, token_type)
      VALUES ($1, $2, true, $3)
      ON CONFLICT (user_id, token) 
      DO UPDATE SET updated_at = NOW(), is_valid = true, token_type = $3
      RETURNING id
    `;
    
    const result = await pool.query(query, [
      userId, 
      pushToken, 
      isExpoToken ? 'expo' : 'fcm'
    ]);
    
    console.log(`Push token stored for user ${userId}`);
    
    res.status(201).json({ 
      message: 'Push token registered successfully',
      tokenId: result.rows[0].id,
      tokenType: isExpoToken ? 'expo' : 'fcm'
    });
  } catch (error) {
    console.error('Error in subscribePush:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};