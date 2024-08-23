const pool = require('../config/db');

exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = {
            text: `SELECT u.id, u.email, u.name
                   FROM users u 
                   WHERE u.id = $1`,
            values: [userId],
        };
        const result = await pool.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getFamilyCalendar = async (req, res) => {
    try {
        const userId = req.user.id;
        const { familyId } = req.params; // Add this line to get the familyId from the request parameters

        // Check if the user is a member of the family
        const checkMembershipQuery = {
            text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
            values: [userId, familyId],
        };
        const membershipResult = await pool.query(checkMembershipQuery);

        if (membershipResult.rows.length === 0) {
            return res.status(403).json({ error: "You are not a member of this family" });
        }

        const query = {
            text: `SELECT * FROM calendar_events
                WHERE family_id = $1
                AND event_date >= CURRENT_DATE
                ORDER BY event_date ASC
                LIMIT 31`,
            values: [familyId],
        };
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getFamilyCalendar:', error);
        res.status(500).json({ error: error.message });
    }
};