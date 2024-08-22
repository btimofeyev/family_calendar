const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const pool = require("../config/db");

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
/*
exports.sendInvitationEmail = async (invitation, familyName) => {
    
    const inviteUrl = `http://localhost:3001/invite.html?token=${invitation.token}`;
    
    const msg = {
        to: invitation.email,
        from: 'support@myhomeschoolevents.com',
        subject: `You're invited to join ${familyName} on Family Dashboard`,
        text: `You've been invited to join ${familyName} on Family Dashboard. Click here to accept: ${inviteUrl}`,
        html: `<p>You've been invited to join ${familyName} on Family Dashboard.</p>
               <p><a href="${inviteUrl}">Click here to accept</a></p>`,
    };

    /* Production DOMAIN SET UP
    const inviteUrl = `https://yourdomain.com/invite.html?token=${invitation.token}`;
    const msg = {
        to: invitation.email,
        from: 'support@myhomeschoolevents.com', // Use your verified sender
        subject: `You're invited to join ${familyName} on Family Dashboard`,
        text: `You've been invited to join ${familyName} on Family Dashboard. Click here to accept: ${inviteUrl}`,
        html: `<p>You've been invited to join ${familyName} on Family Dashboard.</p>
               <p><a href="${inviteUrl}">Click here to accept</a></p>`,
    };

    await sgMail.send(msg);
};
*/
exports.sendInvitationEmail = async (invitation, familyName) => {
  const isProduction = process.env.NODE_ENV === "production";
  const baseUrl = isProduction
    ? "https://famlynook.com"
    : "http://localhost:3001";
  const inviteUrl = `${baseUrl}/invite.html?token=${invitation.token}`;

  const msg = {
    to: invitation.email,
    from: "famlynook@famlynook.com", // Update this to your verified sender email
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
    await sgMail.send(msg);
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
exports.acceptInvitation = async (req, res) => {
  const { token } = req.params;

  try {
    const invitation = await invitationService.getInvitationByToken(token);
    if (!invitation) {
      return res.redirect(`/?error=invalid_invitation`);
    }

    if (invitation.status !== "pending") {
      return res.redirect(`/?error=invitation_already_used`);
    }

    const user = await registerUser(invitation.email);
    await pool.query("UPDATE users SET family_id = $1 WHERE id = $2", [
      invitation.family_id,
      user.id,
    ]);

    await invitationService.markInvitationAsUsed(invitation.id);

    res.redirect(`/?success=invitation_accepted`);
  } catch (error) {
    console.error("Error processing invitation:", error);
    res.redirect(`/?error=invitation_error`);
  }
};

exports.markInvitationAsUsed = async (invitationId) => {
  const query = "UPDATE invitations SET status = $1 WHERE id = $2";
  await pool.query(query, ["used", invitationId]);
};
exports.declineInvitation = async (invitationId) => {
  const query = "UPDATE invitations SET status = 'declined' WHERE id = $1";
  await pool.query(query, [invitationId]);
};
async function registerUser(email) {
  const hashedPassword = await bcrypt.hash("defaultpassword", 10);
  const query =
    "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *";
  const { rows } = await pool.query(query, [email, hashedPassword]);
  return rows[0];
}
