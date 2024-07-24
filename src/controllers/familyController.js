const pool = require('../config/db');



exports.createFamily = async (req, res) => {
    console.log('Request body:', req.body); // Debug log

    const { familyName } = req.body;
    const userId = req.user.id; // Assuming you have user information in the request

    console.log('Family name:', familyName); // Debug log
    console.log('User ID:', userId); // Debug log

    if (!familyName) {
        console.log('Family name is missing'); // Debug log
        return res.status(400).json({ error: 'Family name is required' });
    }

    try {
        // Start a transaction
        await pool.query('BEGIN');

        // Create new family
        const createFamilyQuery = {
            text: 'INSERT INTO families (family_name) VALUES ($1) RETURNING family_id',
            values: [familyName],
        };
        console.log('Executing query:', createFamilyQuery); // Debug log
        const familyResult = await pool.query(createFamilyQuery);
        const familyId = familyResult.rows[0].family_id;
        console.log('Family created with ID:', familyId); // Debug log

        // Update user's family_id
        const updateUserQuery = {
            text: 'UPDATE users SET family_id = $1 WHERE id = $2',
            values: [familyId, userId],
        };
        console.log('Executing query:', updateUserQuery); // Debug log
        await pool.query(updateUserQuery);

        // Commit the transaction
        await pool.query('COMMIT');

        console.log('Family creation successful'); // Debug log
        res.status(201).json({ message: 'Family created successfully', familyId });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error in createFamily:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.addFamilyMember = async (req, res) => {
    const { email } = req.body;
    const userId = req.user.id;

    try {
        // Get user's family_id
        const getFamilyIdQuery = {
            text: 'SELECT family_id FROM users WHERE id = $1',
            values: [userId],
        };
        const familyResult = await pool.query(getFamilyIdQuery);
        const familyId = familyResult.rows[0].family_id;

        if (!familyId) {
            return res.status(400).json({ error: 'User does not belong to a family' });
        }

        // Update the invited user's family_id
        const updateMemberQuery = {
            text: 'UPDATE users SET family_id = $1 WHERE email = $2 RETURNING id, name, email',
            values: [familyId, email],
        };
        const memberResult = await pool.query(updateMemberQuery);

        if (memberResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'Family member added successfully', member: memberResult.rows[0] });
    } catch (error) {
        console.error('Error in addFamilyMember:', error);
        res.status(500).json({ error: error.message });
    }
};
exports.getFamilyMembers = async (req, res) => {
    const userId = req.user.id;

    try {
        // Get user's family_id
        const getFamilyIdQuery = {
            text: 'SELECT family_id FROM users WHERE id = $1',
            values: [userId],
        };
        const familyResult = await pool.query(getFamilyIdQuery);
        const familyId = familyResult.rows[0].family_id;

        if (!familyId) {
            return res.status(400).json({ error: 'User does not belong to a family' });
        }

        // Fetch all members of the family
        const getMembersQuery = {
            text: 'SELECT id, name, email FROM users WHERE family_id = $1',
            values: [familyId],
        };
        const membersResult = await pool.query(getMembersQuery);

        res.status(200).json(membersResult.rows);
    } catch (error) {
        console.error('Error in getFamilyMembers:', error);
        res.status(500).json({ error: error.message });
    }
};