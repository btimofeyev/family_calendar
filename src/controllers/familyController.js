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


    // Update user's family_id
    const updateUserQuery = {
      text: "UPDATE users SET family_id = $1 WHERE id = $2",
      values: [familyId, userId],
    };

    await pool.query(updateUserQuery);

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
  const { email } = req.body;
  const userId = req.user.id;

  try {
    const getFamilyIdQuery = {
      text: "SELECT family_id FROM users WHERE id = $1",
      values: [userId],
    };
    const familyResult = await pool.query(getFamilyIdQuery);
    const familyId = familyResult.rows[0].family_id;

    if (!familyId) {
      return res
        .status(400)
        .json({ error: "User does not belong to a family" });
    }

    // Update the invited user's family_id
    const updateMemberQuery = {
      text: "UPDATE users SET family_id = $1 WHERE email = $2 RETURNING id, name, email",
      values: [familyId, email],
    };
    const memberResult = await pool.query(updateMemberQuery);

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res
      .status(200)
      .json({
        message: "Family member added successfully",
        member: memberResult.rows[0],
      });
  } catch (error) {
    console.error("Error in addFamilyMember:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.getFamilyMembers = async (req, res) => {
  const userId = req.user.id;

  try {
    const getFamilyIdQuery = {
      text: "SELECT family_id FROM users WHERE id = $1",
      values: [userId],
    };
    const familyResult = await pool.query(getFamilyIdQuery);
    const familyId = familyResult.rows[0].family_id;

    if (!familyId) {
      return res
        .status(400)
        .json({ error: "User does not belong to a family" });
    }

    // Fetch all members of the family
    const getMembersQuery = {
      text: "SELECT id, name, email FROM users WHERE family_id = $1",
      values: [familyId],
    };
    const membersResult = await pool.query(getMembersQuery);

    res.status(200).json(membersResult.rows);
  } catch (error) {
    console.error("Error in getFamilyMembers:", error);
    res.status(500).json({ error: error.message });
  }
};
