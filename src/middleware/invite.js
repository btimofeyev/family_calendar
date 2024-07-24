
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const pool = require('../config/db');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const generateToken = () => crypto.randomBytes(20).toString('hex');

exports.createInvitation = async (familyId, email) => {
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); 

    const query = `
        INSERT INTO invitations (family_id, email, token, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;

    const { rows } = await pool.query(query, [familyId, email, token, expiresAt]);
    return rows[0];
};

exports.sendInvitationEmail = async (invitation, familyName) => {
    const msg = {
        to: invitation.email,
        from: 'support@myhomeschoolevents.com',
        subject: `You're invited to join ${familyName} on Family Dashboard`,
        text: `You've been invited to join ${familyName} on Family Dashboard. Click here to accept: http://localhost:3000/?invitationToken=${invitation.token}`,
        html: `<p>You've been invited to join ${familyName} on Family Dashboard.</p>
               <p><a href="http://localhost:3000/?invitationToken=${invitation.token}">Click here to accept</a></p>`,
    };
    /* Production DOMAIN SET UP
    const msg = {
        to: invitation.email,
        from: 'support@myhomeschoolevents.com', // Use your verified sender
        subject: `You're invited to join ${familyName} on Family Dashboard`,
        text: `You've been invited to join ${familyName} on Family Dashboard. Click here to accept: http://yourdomain.com/invite/accept/${invitation.token}`,
        html: `<p>You've been invited to join ${familyName} on Family Dashboard.</p>
               <p><a href="http://yourdomain.com/invite/accept/${invitation.token}">Click here to accept</a></p>`,
    };*/

    await sgMail.send(msg);
};

exports.getInvitationByToken = async (token) => {
    const query = 'SELECT * FROM invitations WHERE token = $1 AND status = \'pending\'';
    const { rows } = await pool.query(query, [token]);
    return rows[0];
};

exports.acceptInvitation = async (invitationId, userId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update invitation status
        await client.query('UPDATE invitations SET status = \'accepted\' WHERE id = $1', [invitationId]);

        // Add user to family
        const { rows } = await client.query('SELECT family_id FROM invitations WHERE id = $1', [invitationId]);
        const familyId = rows[0].family_id;
        await client.query('UPDATE users SET family_id = $1 WHERE id = $2', [familyId, userId]);

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

exports.declineInvitation = async (invitationId) => {
    const query = 'UPDATE invitations SET status = \'declined\' WHERE id = $1';
    await pool.query(query, [invitationId]);
};