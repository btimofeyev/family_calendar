const { createUser, findUserByEmail, validPassword, findUserById } = require('../models/user');
const crypto = require('crypto');
const pool = require('../config/db');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const invitationService = require('../middleware/invite');
const bcrypt = require('bcrypt');


sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const createAccessToken = (user) => {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '45m' });
};

const createRefreshToken = (user) => {
  return jwt.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  const { name, email, password, passkey } = req.body;

  try {
    // Check if user already exists
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let familyId = null;
    let isNewUser = true;

    // If passkey is provided, validate and add user to the family
    if (passkey) {
      const validatePasskeyQuery = {
        text: `SELECT family_id FROM family_passkeys 
               WHERE passkey = $1 AND expires_at > NOW() AND revoked = FALSE`,
        values: [passkey],
      };
      const passkeyResult = await pool.query(validatePasskeyQuery);

      if (passkeyResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid or expired passkey" });
      }

      familyId = passkeyResult.rows[0].family_id;
      isNewUser = false;  
    }

    // Create user
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    if (familyId) {
      // Add user to the family
      await pool.query(
        "INSERT INTO user_families (user_id, family_id) VALUES ($1, $2)",
        [newUser.rows[0].id, familyId]
      );
    }

    // Generate JWT token
    const token = jwt.sign({ userId: newUser.rows[0].id, familyId }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.rows[0].id,
        name: newUser.rows[0].name,
        email: newUser.rows[0].email,
        family_id: familyId,
      },
      isNewUser: isNewUser,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    console.log('Debug - Processing forgot password for email:', email);
    
    // Check if user exists
    const userQuery = {
      text: 'SELECT * FROM users WHERE email = $1',
      values: [email],
    };
    
    const userResult = await pool.query(userQuery);
    
    // If no user found, we still return success for security reasons
    if (userResult.rows.length === 0) {
      console.log('Debug - No user found with email:', email);
      return res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent' 
      });
    }

    const user = userResult.rows[0];
    console.log('Debug - User found:', user.email);
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration time to 24 hours from now, using the database's NOW() function
    // to ensure consistency between application and database timestamps
    const tokenExpiryQuery = {
      text: `SELECT NOW() + INTERVAL '24 hours' as expiry_time`,
    };
    
    const expiryResult = await pool.query(tokenExpiryQuery);
    const resetTokenExpiry = expiryResult.rows[0].expiry_time;
    
    console.log('Debug - Generated token:', resetToken);
    console.log('Debug - Token expiry time:', resetTokenExpiry);
    
    // Store token in database
    const updateQuery = {
      text: `UPDATE users 
             SET reset_token = $1, reset_token_expires = $2 
             WHERE id = $3
             RETURNING reset_token, reset_token_expires`,
      values: [resetToken, resetTokenExpiry, user.id],
    };
    
    const updateResult = await pool.query(updateQuery);
    console.log('Debug - Token stored in database:', updateResult.rows[0]);
    
    // Send email with reset link
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction 
      ? 'https://famlynook.com' 
      : 'http://localhost:3001';
    
    const resetUrl = `${baseUrl}/reset-password.html?token=${resetToken}`;
    console.log('Debug - Reset URL:', resetUrl);
    
    const msg = {
      to: email,
      from: 'famlynook@famlynook.com', // Your verified sender
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click on the following link to reset your password: ${resetUrl}`,
      html: `
        <p>You requested a password reset.</p>
        <p>Please click on the link below to reset your password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
      `,
    };
    
    try {
      await sgMail.send(msg);
      console.log('Debug - Reset email sent to:', email);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // We don't want to expose email errors to the client
    }
    
    res.status(200).json({ 
      message: 'If an account with that email exists, a password reset link has been sent' 
    });
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};
// Add this function for resetting the password
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  
  try {
    console.log('Debug - Token received:', token);
    
    // First, check if the token exists at all, regardless of expiration
    const tokenCheckQuery = {
      text: `SELECT id, email, reset_token, reset_token_expires FROM users WHERE reset_token = $1`,
      values: [token],
    };
    
    console.log('Debug - Initial token check query:', tokenCheckQuery.text);
    const tokenCheckResult = await pool.query(tokenCheckQuery);
    
    if (tokenCheckResult.rows.length === 0) {
      console.log('Debug - Token not found in database');
      return res.status(400).json({ error: 'Invalid token. Please request a new password reset link.' });
    }
    
    // Token exists, now let's check if it's expired
    const user = tokenCheckResult.rows[0];
    console.log('Debug - User found:', user.email);
    console.log('Debug - Token expiration time:', user.reset_token_expires);
    
    // Get current time in database's timezone
    const currentTimeQuery = `SELECT NOW() as current_time`;
    const currentTimeResult = await pool.query(currentTimeQuery);
    const currentTime = currentTimeResult.rows[0].current_time;
    
    console.log('Debug - Current database time:', currentTime);
    
    // Compare dates manually
    const expiryTime = new Date(user.reset_token_expires).getTime();
    const nowTime = new Date(currentTime).getTime();
    
    console.log('Debug - Expiry timestamp:', expiryTime);
    console.log('Debug - Current timestamp:', nowTime);
    
    if (expiryTime < nowTime) {
      console.log('Debug - Token is expired');
      return res.status(400).json({ error: 'Token has expired. Please request a new password reset link.' });
    }
    
    console.log('Debug - Token is valid and not expired');
    
    // Token is valid, proceed with password reset
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('Debug - Password hashed');
    
    // Update user with new password and clear reset token
    const updateQuery = {
      text: `UPDATE users 
             SET password = $1, reset_token = NULL, reset_token_expires = NULL 
             WHERE id = $2`,
      values: [hashedPassword, user.id],
    };
    
    await pool.query(updateQuery);
    console.log('Debug - Password updated for user:', user.email);
    
    res.status(200).json({ message: 'Password has been reset successfully' });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password: ' + error.message });
  }
};
exports.registerInvited = async (req, res) => {
  try {
      const { name, email, password, token } = req.body;
      
      const invitation = await invitationService.getInvitationByToken(token);
      if (!invitation || invitation.email !== email) {
          return res.status(400).json({ error: 'Invalid invitation' });
      }

      let user = await findUserByEmail(email);
      
      if (user) {
          const updateQuery = {
              text: 'UPDATE users SET name = $1, family_id = $2 WHERE email = $3 RETURNING *',
              values: [name, invitation.family_id, email],
          };
          const result = await pool.query(updateQuery);
          user = result.rows[0];
      } else {
          user = await createUser({ name, email, password, family_id: invitation.family_id });
      }

      await invitationService.markInvitationAsUsed(invitation.id);

      const jwtToken = jwt.sign({ userId: user.id, familyId: user.family_id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      
      res.status(201).json({ 
          user: { 
              id: user.id, 
              email: user.email, 
              name: user.name, 
              family_id: user.family_id 
          }, 
          token: jwtToken 
      });
  } catch (error) {
      console.error('Error in registerInvited:', error);
      res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  console.log('🔒 Login attempt received:', { email: req.body.email });
  console.log('📡 Request IP:', req.ip || 'unknown');
  console.log('📱 User-Agent:', req.headers['user-agent']);
  
  try {
    const { email, password } = req.body;
    console.log('👤 Looking up user by email...');
    
    const user = await findUserByEmail(email);
    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log('✅ User found:', { id: user.id, name: user.name });
    console.log('🔑 Validating password...');
    
    const isValidPassword = await validPassword(password, user.password);
    if (!isValidPassword) {
      console.log('❌ Invalid password for user:', user.id);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log('✅ Password valid, generating tokens...');
    
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    console.log('🎟️ Tokens generated successfully');

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    console.log('🍪 Refresh token cookie set');

    // Check if the user has any families
    console.log('👪 Checking user families...');
    const userFamilies = await getUserFamilies(user.id);
    console.log('👪 User families:', userFamilies);
    const isNewUser = userFamilies.length === 0;

    const responseData = { 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        family_id: user.family_id 
      }, 
      token: accessToken,
      isNewUser: isNewUser
    };
    
    console.log('📤 Sending login response:', {
      userId: user.id,
      hasToken: !!accessToken,
      isNewUser
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('💥 Login error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
};

// Add this new function to get user families
async function getUserFamilies(userId) {
  const query = {
    text: `SELECT f.family_id, f.family_name 
           FROM families f
           JOIN user_families uf ON f.family_id = uf.family_id
           WHERE uf.user_id = $1`,
    values: [userId],
  };
  const result = await pool.query(query);
  return result.rows;
}

exports.checkInvitation = async (req, res) => {
  const { token } = req.params;
  try {
      const invitation = await invitationService.getInvitationByToken(token);

      if (invitation) {
          const family = await familyService.getFamilyById(invitation.family_id);
          res.json({ valid: true, email: invitation.email, familyName: family.name });
      } else {
          res.json({ valid: false });
      }
  } catch (error) {
      console.error('Error checking invitation:', error);
      res.status(500).json({ error: 'Failed to check invitation', details: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  // Accept token from body instead of cookie
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const accessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user);

    // Return both tokens in the response body
    res.json({ 
      token: accessToken,
      refreshToken: newRefreshToken 
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};

exports.logout = (req, res) => {
  res.cookie('refreshToken', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/api/auth/refresh-token' });
  res.status(200).json({ message: 'Logged out successfully' });
};