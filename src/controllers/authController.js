const { createUser, findUserByEmail, validPassword } = require('../models/user');
const jwt = require('jsonwebtoken');
const invitationService = require('../middleware/invite');

exports.register = async (req, res) => {
  try {
    const { email, password, name, invitationToken } = req.body;
    let user = await createUser({ email, password, name });
    
    if (invitationToken) {
      const invitation = await invitationService.getInvitationByToken(invitationToken);
      if (invitation && invitation.email === email) {
        await invitationService.acceptInvitation(invitation.id, user.id);
        // Fetch the updated user to get the family_id
        user = await findUserByEmail(email);
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
    res.status(400).json({ error: error.message });
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
  try {
    const invitation = await invitationService.getInvitationByToken(token);
    if (invitation) {
      res.json({ valid: true, email: invitation.email });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};