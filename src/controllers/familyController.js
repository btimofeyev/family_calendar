const pool = require("../config/db");

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