const pool = require("../config/db");
const { uploadToS3 } = require("../middleware/imageUpload");
const invitationService = require('../middleware/invite');

function generatePasskey() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = Math.floor(Math.random() * (12 - 8 + 1)) + 8;
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

exports.createFamily = async (req, res) => {
  const { familyName } = req.body;
  const userId = req.user.id;

  if (!familyName) {
    return res.status(400).json({ error: "Family name is required" });
  }

  try {
    await pool.query("BEGIN");

    // Create new family
    const createFamilyQuery = {
      text: "INSERT INTO families (family_name) VALUES ($1) RETURNING family_id",
      values: [familyName],
    };

    const familyResult = await pool.query(createFamilyQuery);
    const familyId = familyResult.rows[0].family_id;

    // Add user to the new family
    const addUserToFamilyQuery = {
      text: "INSERT INTO user_families (user_id, family_id) VALUES ($1, $2)",
      values: [userId, familyId],
    };

    await pool.query(addUserToFamilyQuery);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(201).json({ message: "Family created successfully", familyId });
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error in createFamily:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.addFamilyMember = async (req, res) => {
  const { familyId } = req.params;
  const { email } = req.body;
  const inviterId = req.user.id;

  try {
    // Check if the inviter is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [inviterId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    // Check if the invited user exists
    const getUserQuery = {
      text: "SELECT id FROM users WHERE email = $1",
      values: [email],
    };
    const userResult = await pool.query(getUserQuery);

    if (userResult.rows.length === 0) {
      // If the user doesn't exist, you might want to send an invitation email here
      return res.status(404).json({ error: "User not found. An invitation email will be sent." });
    }

    const invitedUserId = userResult.rows[0].id;

    // Add the invited user to the family
    const addMemberQuery = {
      text: "INSERT INTO user_families (user_id, family_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      values: [invitedUserId, familyId],
    };
    await pool.query(addMemberQuery);

    res.status(200).json({ message: "Family member added successfully" });
  } catch (error) {
    console.error("Error in addFamilyMember:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getFamilyMembers = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    // Check if the user is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    // Fetch all members of the family
    const getMembersQuery = {
      text: `SELECT u.id, u.name, u.email 
             FROM users u
             JOIN user_families uf ON u.id = uf.user_id
             WHERE uf.family_id = $1`,
      values: [familyId],
    };
    const membersResult = await pool.query(getMembersQuery);

    res.status(200).json(membersResult.rows);
  } catch (error) {
    console.error("Error in getFamilyMembers:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getUserFamilies = async (req, res) => {
  const userId = req.user.id;

  try {
    const query = {
      text: `SELECT f.family_id, f.family_name 
             FROM families f
             JOIN user_families uf ON f.family_id = uf.family_id
             WHERE uf.user_id = $1`,
      values: [userId],
    };
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error in getUserFamilies:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getFamilyDetails = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    // Check if the user is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    // Fetch family details
    const getFamilyQuery = {
      text: "SELECT * FROM families WHERE family_id = $1",
      values: [familyId],
    };
    const familyResult = await pool.query(getFamilyQuery);

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: "Family not found" });
    }

    res.status(200).json(familyResult.rows[0]);
  } catch (error) {
    console.error("Error in getFamilyDetails:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.uploadFamilyPhoto = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    // Check if the user is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const photoUrl = await uploadToS3(req.file);

    const updatePhotoQuery = {
      text: "UPDATE families SET photo_url = $1 WHERE family_id = $2",
      values: [photoUrl, familyId],
    };
    await pool.query(updatePhotoQuery);

    res.status(200).json({ message: "Family photo uploaded successfully", photoUrl });
  } catch (error) {
    console.error("Error uploading family photo:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.inviteMembers = async (req, res) => {
  const { familyId } = req.params;
  const { emails } = req.body;
  const inviterId = req.user.id;

  try {
    // Check if the inviter is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [inviterId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    const invitationResults = await Promise.all(
      emails.map(async (email) => {
        try {
          await invitationService.createInvitation(email, familyId, inviterId);
          return { email, status: 'success' };
        } catch (error) {
          console.error(`Error inviting ${email}:`, error);
          return { email, status: 'failed', error: error.message };
        }
      })
    );

    res.status(200).json({ message: "Invitations sent", results: invitationResults });
  } catch (error) {
    console.error("Error inviting members:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add this new function to generate a passkey for a family
exports.generateFamilyPasskey = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    console.log(`Generating passkey for family ${familyId} by user ${userId}`);
    // Check if the user is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    const passkey = generatePasskey();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const insertPasskeyQuery = {
      text: "INSERT INTO family_passkeys (family_id, passkey, expires_at) VALUES ($1, $2, $3) RETURNING passkey",
      values: [familyId, passkey, expiresAt],
    };
    const result = await pool.query(insertPasskeyQuery);

    res.status(200).json({ passkey: result.rows[0].passkey, expiresAt });
  } catch (error) {
    console.error("Error generating family passkey:", error);
    res.status(500).json({ error: error.message });
  }
};

// Add this new function to validate a passkey
exports.validatePasskey = async (req, res) => {
  const { passkey } = req.body;

  try {
    const validatePasskeyQuery = {
      text: `SELECT fp.family_id, f.family_name 
             FROM family_passkeys fp
             JOIN families f ON fp.family_id = f.family_id
             WHERE fp.passkey = $1 AND fp.expires_at > NOW() AND fp.revoked = FALSE`,
      values: [passkey],
    };
    const result = await pool.query(validatePasskeyQuery);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired passkey" });
    }

    res.status(200).json({ 
      valid: true, 
      familyId: result.rows[0].family_id,
      familyName: result.rows[0].family_name
    });
  } catch (error) {
    console.error("Error validating passkey:", error);
    res.status(500).json({ error: error.message });
  }
};