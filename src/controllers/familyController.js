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

    const createFamilyQuery = {
      text: "INSERT INTO families (family_name) VALUES ($1) RETURNING family_id",
      values: [familyName],
    };

    const familyResult = await pool.query(createFamilyQuery);
    const familyId = familyResult.rows[0].family_id;

    const addUserToFamilyQuery = {
      text: "INSERT INTO user_families (user_id, family_id) VALUES ($1, $2)",
      values: [userId, familyId],
    };

    await pool.query(addUserToFamilyQuery);
    await pool.query("COMMIT");

    res.status(201).json({ message: "Family created successfully", familyId });
  } catch (error) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  }
};

exports.addFamilyMember = async (req, res) => {
  const { familyId } = req.params;
  const { email } = req.body;
  const inviterId = req.user.id;

  try {
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [inviterId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    const getUserQuery = {
      text: "SELECT id FROM users WHERE email = $1",
      values: [email],
    };
    const userResult = await pool.query(getUserQuery);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found. An invitation email will be sent." });
    }

    const invitedUserId = userResult.rows[0].id;

    const addMemberQuery = {
      text: "INSERT INTO user_families (user_id, family_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      values: [invitedUserId, familyId],
    };
    await pool.query(addMemberQuery);

    res.status(200).json({ message: "Family member added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getFamilyMembers = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }
    const getMembersQuery = {
      text: `SELECT u.id, u.name, u.email, u.profile_image 
             FROM users u
             JOIN user_families uf ON u.id = uf.user_id
             WHERE uf.family_id = $1`,
      values: [familyId],
    };
    const membersResult = await pool.query(getMembersQuery);

    res.status(200).json(membersResult.rows);
  } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
};

exports.getFamilyDetails = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

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
    res.status(500).json({ error: error.message });
  }
};

exports.uploadFamilyPhoto = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
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
    res.status(500).json({ error: error.message });
  }
};

exports.inviteMembers = async (req, res) => {
  const { familyId } = req.params;
  const { emails } = req.body;
  const inviterId = req.user.id;

  try {
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
          return { email, status: 'failed', error: error.message };
        }
      })
    );

    res.status(200).json({ message: "Invitations sent", results: invitationResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.generateFamilyPasskey = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
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
    res.status(500).json({ error: error.message });
  }
};

exports.validatePasskey = async (req, res) => {
  const { passkey } = req.body;
  const userId = req.user ? req.user.id : null;

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
    
    const familyId = result.rows[0].family_id;
    const familyName = result.rows[0].family_name;
    
    if (userId) {
      const checkMembershipQuery = {
        text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
        values: [userId, familyId],
      };
      const membershipResult = await pool.query(checkMembershipQuery);
      
      if (membershipResult.rows.length === 0) {
        const addMemberQuery = {
          text: "INSERT INTO user_families (user_id, family_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          values: [userId, familyId],
        };
        await pool.query(addMemberQuery);
        
        const updateUserQuery = {
          text: "UPDATE users SET family_id = $1 WHERE id = $2 AND (family_id IS NULL OR family_id = 0)",
          values: [familyId, userId],
        };
        await pool.query(updateUserQuery);
      }
    }

    res.status(200).json({ 
      valid: true, 
      familyId: familyId,
      familyName: familyName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.leaveFamilyGroup = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    const countMembersQuery = {
      text: "SELECT COUNT(*) FROM user_families WHERE family_id = $1",
      values: [familyId],
    };
    const countResult = await pool.query(countMembersQuery);
    const memberCount = parseInt(countResult.rows[0].count);

    await pool.query('BEGIN');

    const removeUserQuery = {
      text: "DELETE FROM user_families WHERE user_id = $1 AND family_id = $2 RETURNING *",
      values: [userId, familyId],
    };
    await pool.query(removeUserQuery);

    const updateUserQuery = {
      text: "UPDATE users SET family_id = NULL WHERE id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    await pool.query(updateUserQuery);

    if (memberCount <= 1) {
      await pool.query("DELETE FROM family_passkeys WHERE family_id = $1", [familyId]);
      await pool.query("DELETE FROM invitations WHERE family_id = $1", [familyId]);
      await pool.query("DELETE FROM posts WHERE family_id = $1", [familyId]);
      await pool.query("DELETE FROM calendar_events WHERE family_id = $1", [familyId]);
      await pool.query("DELETE FROM memories WHERE family_id = $1", [familyId]);
      await pool.query("DELETE FROM families WHERE family_id = $1", [familyId]);
    }

    await pool.query('COMMIT');

    res.status(200).json({ message: "Successfully left family group" });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
};