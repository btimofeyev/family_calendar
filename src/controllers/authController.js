const { createUser, findUserByEmail, validPassword, findUserById } = require('../models/user');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const invitationService = require('../middleware/invite');
const bcrypt = require('bcrypt');

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
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const isValidPassword = await validPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Check if the user has any families
    const userFamilies = await getUserFamilies(user.id);
    const isNewUser = userFamilies.length === 0;

    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        family_id: user.family_id 
      }, 
      token: accessToken,
      isNewUser: isNewUser
    });
  } catch (error) {
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
  const { refreshToken } = req.cookies;
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

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ token: accessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};

exports.logout = (req, res) => {
  res.cookie('refreshToken', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/api/auth/refresh-token' });
  res.status(200).json({ message: 'Logged out successfully' });
};