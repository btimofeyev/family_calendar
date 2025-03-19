// src/controllers/accountController.js
const pool = require('../config/db');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.requestAccountDeletion = async (req, res) => {
  const userId = req.user.id;
  
  try {
    // Generate a unique token for the deletion request
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token valid for 24 hours
    
    // Save the deletion request in the database
    const query = {
      text: `INSERT INTO deletion_requests (user_id, token, expires_at, status)
             VALUES ($1, $2, $3, 'pending')
             ON CONFLICT (user_id) 
             WHERE status = 'pending'
             DO UPDATE SET token = $2, expires_at = $3
             RETURNING *`,
      values: [userId, token, expiresAt]
    };
    
    const result = await pool.query(query);
    
    // Get user email
    const userQuery = {
      text: 'SELECT email, name FROM users WHERE id = $1',
      values: [userId]
    };
    
    const userResult = await pool.query(userQuery);
    const userEmail = userResult.rows[0].email;
    const userName = userResult.rows[0].name;
    
    // Send confirmation email with deletion link
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction ? 'https://famlynook.com' : 'http://localhost:3001';
    const confirmationUrl = `${baseUrl}/confirm-deletion.html?token=${token}`;
    
    const message = {
      to: userEmail,
      from: 'famlynook@famlynook.com', // Your verified sender
      subject: 'Confirm Your FamlyNook Account Deletion Request',
      html: `
        <p>Hello ${userName},</p>
        <p>We've received a request to delete your FamlyNook account. If you made this request, please click the link below to confirm your account deletion:</p>
        <p><a href="${confirmationUrl}">Confirm Account Deletion</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this deletion, please ignore this email or contact our support team.</p>
        <p>Thank you,<br>The FamlyNook Team</p>
      `
    };
    
    await sgMail.send(message);
    
    res.status(200).json({ 
      message: 'Account deletion request received. Please check your email to confirm.'
    });
  } catch (error) {
    console.error('Error requesting account deletion:', error);
    res.status(500).json({ error: 'Failed to process your account deletion request' });
  }
};
exports.confirmAccountDeletion = async (req, res) => {
    console.log('Received deletion confirmation request:', req.body);
    
    const { token } = req.body;
    
    if (!token) {
      console.error('No token provided in request body');
      return res.status(400).json({ error: 'Token is required' });
    }
    
    try {
      console.log('Verifying token:', token);
      
      // Verify the token is valid and not expired
      const query = {
        text: `SELECT * FROM deletion_requests 
               WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
        values: [token]
      };
      
      const result = await pool.query(query);
      console.log('Token verification result rows:', result.rows.length);
      
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }
      
      const userId = result.rows[0].user_id;
      console.log('Deleting account for user ID:', userId);
      
      // Begin transaction to delete user data
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Update deletion request status
        await client.query(
          'UPDATE deletion_requests SET status = $1, deleted_at = NOW() WHERE token = $2',
          ['completed', token]
        );
        
        // Delete or anonymize user data
        // Here you should delete all user's personal data from various tables
        // For example:
        
        // 1. Remove user from families
        await client.query('DELETE FROM user_families WHERE user_id = $1', [userId]);
        
        // 2. Delete user's posts, comments, and likes
        const userPosts = await client.query('SELECT post_id FROM posts WHERE author_id = $1', [userId]);
        for (const post of userPosts.rows) {
          await client.query('DELETE FROM likes WHERE post_id = $1', [post.post_id]);
          await client.query('DELETE FROM comments WHERE post_id = $1', [post.post_id]);
        }
        await client.query('DELETE FROM posts WHERE author_id = $1', [userId]);
        
        // 3. Delete user's comments on other posts
        await client.query('DELETE FROM comments WHERE author_id = $1', [userId]);
        
        // 4. Delete user's likes
        await client.query('DELETE FROM likes WHERE user_id = $1', [userId]);
        
        // 5. Delete user's notifications
        await client.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
        
        // 6. Delete push subscriptions
        await client.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
        
        // Get user email for audit log
        const userQuery = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
        const userEmail = userQuery.rows.length > 0 ? userQuery.rows[0].email : 'unknown@email.com';
        
        // 7. Create an audit log entry
        await client.query(
          'INSERT INTO deletion_audit_log (user_id, email, deleted_at) VALUES ($1, $2, NOW())',
          [userId, userEmail]
        );
        
        // 8. Finally, delete or anonymize the user
        // Option 1: Complete deletion
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        
        // Option 2: Anonymization (alternative approach)
        // const anonymizedEmail = `deleted_${userId}@anonymized.com`;
        // await client.query(
        //   `UPDATE users 
        //    SET name = 'Deleted User', 
        //        email = $1, 
        //        password = NULL, 
        //        reset_token = NULL, 
        //        reset_token_expires = NULL,
        //        is_deleted = TRUE
        //    WHERE id = $2`,
        //   [anonymizedEmail, userId]
        // );
        
        await client.query('COMMIT');
        console.log('Account deletion completed successfully for user ID:', userId);
        
        res.status(200).json({ message: 'Your account has been deleted successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error confirming account deletion:', error);
        res.status(500).json({ error: 'Failed to delete your account: ' + error.message });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error confirming account deletion:', error);
      res.status(500).json({ error: 'Failed to delete your account: ' + error.message });
    }
  };

exports.cancelAccountDeletion = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Cancel any pending deletion request
    const query = {
      text: `UPDATE deletion_requests 
             SET status = 'cancelled', updated_at = NOW() 
             WHERE user_id = $1 AND status = 'pending'`,
      values: [userId]
    };
    
    await pool.query(query);
    
    res.status(200).json({ message: 'Account deletion request cancelled' });
  } catch (error) {
    console.error('Error cancelling account deletion:', error);
    res.status(500).json({ error: 'Failed to cancel account deletion request' });
  }
};

// Check if a user has a pending deletion request
exports.checkDeletionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const query = {
      text: `SELECT * FROM deletion_requests 
             WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()`,
      values: [userId]
    };
    
    const result = await pool.query(query);
    
    res.status(200).json({ 
      hasPendingRequest: result.rows.length > 0,
      requestDetails: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error checking deletion status:', error);
    res.status(500).json({ error: 'Failed to check account deletion status' });
  }
};

