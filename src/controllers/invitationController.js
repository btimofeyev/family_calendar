// invitationController.js
const invitationService = require('../middleware/invite');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken'); // Make sure to import this

exports.inviteMember = [authMiddleware, async (req, res) => {
    const { email, familyId } = req.body;

    try {
        console.log('Inviting member:', email, 'to family:', familyId);
        
        // Get family name
        const { rows: familyRows } = await pool.query('SELECT family_name FROM families WHERE family_id = $1', [familyId]);
        if (familyRows.length === 0) {
            return res.status(404).json({ error: 'Family not found' });
        }

        console.log('Family found:', familyRows[0].family_name);

        const invitation = await invitationService.createInvitation(familyId, email);
        console.log('Invitation created:', invitation);

        await invitationService.sendInvitationEmail(invitation, familyRows[0].family_name);
        console.log('Invitation email sent');

        res.status(201).json({ message: 'Invitation sent successfully' });
    } catch (error) {
        console.error('Error inviting member:', error);
        res.status(500).json({ error: 'Failed to send invitation', details: error.message });
    }
}];

exports.acceptInvitation = async (req, res) => {
  const { token } = req.params;
  const { name, password } = req.body;

  try {
    const userId = await invitationService.acceptInvitation(token, name, password);
    // Generate a JWT token for the new user
    const jwtToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ 
      message: 'Invitation accepted successfully', 
      token: jwtToken,
      userId: userId
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.declineInvitation = async (req, res) => {
    const { token } = req.params;

    try {
        const invitation = await invitationService.getInvitationByToken(token);
        if (!invitation) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        await invitationService.declineInvitation(invitation.id);
        res.json({ message: 'Invitation declined successfully' });
    } catch (error) {
        console.error('Error declining invitation:', error);
        res.status(500).json({ error: 'Failed to decline invitation' });
    }
};
exports.checkInvitation = async (req, res) => {
    const { token } = req.params;
    try {
        const invitation = await invitationService.getInvitationByToken(token);

        if (invitation) {
            const familyQuery = {
                text: 'SELECT family_name FROM families WHERE family_id = $1',
                values: [invitation.family_id],
            };
            const familyResult = await pool.query(familyQuery);
            const family = familyResult.rows[0];


            if (family) {
                res.json({ valid: true, email: invitation.email, familyName: family.family_name });
            } else {

                res.json({ valid: false, error: 'Family not found' });
            }
        } else {
            res.json({ valid: false });
        }
    } catch (error) {
        console.error('Error checking invitation:', error);
        res.status(500).json({ error: 'Failed to check invitation', details: error.message });
    }
};