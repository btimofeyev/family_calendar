const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const pool = require("../config/db");
const bcrypt = require('bcrypt');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const generateToken = () => crypto.randomBytes(20).toString("hex");

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
  const isProduction = process.env.NODE_ENV === "production";
  const baseUrl = isProduction
    ? "https://famlynook.com"
    : "http://localhost:3001";
  const inviteUrl = `${baseUrl}/invite.html?token=${invitation.token}`;

  const msg = {
    to: invitation.email,
    from: "famlynook@famlynook.com", // Make sure this is your verified sender email in SendGrid
    subject: `You're invited to join ${familyName} on FamilyNook`,
    text: `You've been invited to join ${familyName} on FamilyNook. Click here to accept: ${inviteUrl}`,
    html: `
      <p>You've been invited to join ${familyName} on FamilyNook.</p>
      <p><a href="${inviteUrl}">Click here to accept</a></p>
      <p>If you're unable to click the link, copy and paste this URL into your browser:</p>
      <p>${inviteUrl}</p>
    `,
  };

  try {
    console.log('Attempting to send email:', msg);
    await sgMail.send(msg);
    console.log('Email sent successfully');
  } catch (error) {
    console.error("Error sending invitation email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw new Error("Failed to send invitation email");
  }
};

exports.getInvitationByToken = async (token) => {
  const query =
    "SELECT * FROM invitations WHERE token = $1 AND status = 'pending'";
  const { rows } = await pool.query(query, [token]);
  return rows[0];
};

exports.acceptInvitation = async (token, name, password) => {
  const invitation = await exports.getInvitationByToken(token);
  if (!invitation || invitation.status !== "pending") {
    throw new Error("Invalid or expired invitation");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `
    INSERT INTO users (email, password, name) 
    VALUES ($1, $2, $3) 
    RETURNING id
  `;
  const { rows } = await pool.query(query, [invitation.email, hashedPassword, name]);
  const userId = rows[0].id;

  // Add user to the family
  await pool.query(`
    INSERT INTO user_families (user_id, family_id) 
    VALUES ($1, $2)
  `, [userId, invitation.family_id]);

  await exports.markInvitationAsUsed(invitation.id);

  return userId;
};

exports.markInvitationAsUsed = async (invitationId) => {
  const query = "UPDATE invitations SET status = $1 WHERE id = $2";
  await pool.query(query, ["used", invitationId]);
};

exports.declineInvitation = async (invitationId) => {
  const query = "UPDATE invitations SET status = 'declined' WHERE id = $1";
  await pool.query(query, [invitationId]);
};