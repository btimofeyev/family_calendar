const { createUser, findUserByEmail, validPassword } = require('../models/user');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const invitationService = require('../middleware/invite');

const createAccessToken = (user) => {
  return jwt.sign({ userId: user.id, familyId: user.family_id }, process.env.JWT_SECRET, { expiresIn: '45m' });
};

const createRefreshToken = (user) => {
  return jwt.sign({ userId: user.id, familyId: user.family_id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};
exports.register = async (req, res) => {
  try {
    const { email, password, name, invitationToken } = req.body;
    let user = await createUser({ email, password, name });

    if (invitationToken) {
      const invitation = await invitationService.getInvitationByToken(invitationToken);

      if (invitation && invitation.email === email) {
        const updateResult = await pool.query('UPDATE users SET family_id = $1 WHERE id = $2 RETURNING *', [invitation.family_id, user.id]);
        user = updateResult.rows[0];

        await invitationService.markInvitationAsUsed(invitation.id);
      } else {

      }
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    // Store the refresh token in an HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', 
      path: '/api/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    res.status(201).json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        family_id: user.family_id 
      }, 
      token: accessToken 
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: error.message });
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

    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        family_id: user.family_id 
      }, 
      token: accessToken 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
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
exports.refreshToken = (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const user = { id: decoded.userId, family_id: decoded.familyId };
    const accessToken = createAccessToken(user);

    res.json({ token: accessToken });
  });
};
exports.logout = (req, res) => {
  res.cookie('refreshToken', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/api/auth/refresh-token' });
  res.status(200).json({ message: 'Logged out successfully' });
};