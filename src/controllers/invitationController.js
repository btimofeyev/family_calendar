// invitationController.js
const invitationService = require('../middleware/invite');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

exports.inviteMember = [authMiddleware, async (req, res) => {
    const { email } = req.body;
    const familyId = req.user.family_id;

    try {
        // Get family name
        const { rows: familyRows } = await pool.query('SELECT family_name FROM families WHERE family_id = $1', [familyId]);
        if (familyRows.length === 0) {
            return res.status(404).json({ error: 'Family not found' });
        }

        const invitation = await invitationService.createInvitation(familyId, email);
        await invitationService.sendInvitationEmail(invitation, familyRows[0].family_name);

        res.status(201).json({ message: 'Invitation sent successfully' });
    } catch (error) {
        console.error('Error inviting member:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
}];
exports.acceptInvitation = async (req, res) => {
    const { token } = req.params;

    try {
        const invitation = await invitationService.getInvitationByToken(token);
        if (!invitation) {
            return res.redirect(`/?error=invalid_invitation`);
        }

        // Check if the invitation has already been used
        if (invitation.status !== 'pending') {
            return res.redirect(`/?error=invitation_already_used`);
        }

        // Redirect to the main page with the token as a query parameter
        res.redirect(`/?invitationToken=${token}`);
    } catch (error) {
        console.error('Error processing invitation:', error);
        res.redirect(`/?error=invitation_error`);
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
    console.log('Checking invitation token:', token);
    try {
        const invitation = await invitationService.getInvitationByToken(token);
        console.log('Invitation found:', invitation);
        if (invitation) {
            // Get family name directly using pool
            const familyQuery = {
                text: 'SELECT family_name FROM families WHERE family_id = $1',
                values: [invitation.family_id],
            };
            const familyResult = await pool.query(familyQuery);
            const family = familyResult.rows[0];
            console.log('Family found:', family);

            if (family) {
                res.json({ valid: true, email: invitation.email, familyName: family.family_name });
            } else {
                console.log('Family not found for invitation:', invitation);
                res.json({ valid: false, error: 'Family not found' });
            }
        } else {
            console.log('No valid invitation found for token:', token);
            res.json({ valid: false });
        }
    } catch (error) {
        console.error('Error checking invitation:', error);
        res.status(500).json({ error: 'Failed to check invitation', details: error.message });
    }
};