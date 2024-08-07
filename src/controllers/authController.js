const { createUser, findUserByEmail, validPassword } = require('../models/user');
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const invitationService = require('../middleware/invite');

exports.register = async (req, res) => {
  try {
    const { email, password, name, invitationToken } = req.body;
    console.log('Request body:', req.body);


    console.log('Registering user:', email, 'with invitation token:', invitationToken);
    
    let user = await createUser({ email, password, name });
    console.log('Created user:', user);

    if (invitationToken) {
      const invitation = await invitationService.getInvitationByToken(invitationToken);
      console.log('Found invitation:', invitation);

      if (invitation && invitation.email === email) {
        const updateResult = await pool.query('UPDATE users SET family_id = $1 WHERE id = $2 RETURNING *', [invitation.family_id, user.id]);
        user = updateResult.rows[0];
        console.log('Updated user after processing invitation:', user);
        
        await invitationService.markInvitationAsUsed(invitation.id);
      } else {
        console.log('Invalid invitation or email mismatch');
      }
    }

    const token = jwt.sign({ userId: user.id, familyId: user.family_id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        family_id: user.family_id 
      }, 
      token 
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

      // Check if user already exists
      let user = await findUserByEmail(email);
      
      if (user) {
          // Update existing user
          const updateQuery = {
              text: 'UPDATE users SET name = $1, family_id = $2 WHERE email = $3 RETURNING *',
              values: [name, invitation.family_id, email],
          };
          const result = await pool.query(updateQuery);
          user = result.rows[0];
      } else {
          // Create new user
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
    const token = jwt.sign({ userId: user.id, familyId: user.family_id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        family_id: user.family_id 
      }, 
      token 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkInvitation = async (req, res) => {
  const { token } = req.params;
  console.log('Checking invitation token:', token);
  try {
      const invitation = await invitationService.getInvitationByToken(token);
      console.log('Invitation found:', invitation);
      if (invitation) {
          const family = await familyService.getFamilyById(invitation.family_id);
          console.log('Family found:', family);
          res.json({ valid: true, email: invitation.email, familyName: family.name });
      } else {
          console.log('No valid invitation found for token:', token);
          res.json({ valid: false });
      }
  } catch (error) {
      console.error('Error checking invitation:', error);
      res.status(500).json({ error: 'Failed to check invitation', details: error.message });
  }
};