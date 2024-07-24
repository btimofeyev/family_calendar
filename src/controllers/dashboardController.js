const pool = require('../config/db');



exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = {
            text: `SELECT u.id, u.email, u.name, u.family_id, f.family_name 
                   FROM users u 
                   LEFT JOIN families f ON u.family_id = f.family_id 
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
        const query = {
            text: `SELECT * FROM calendar_events
                WHERE family_id = (SELECT family_id FROM users WHERE id = $1)
                AND event_date >= CURRENT_DATE
                ORDER BY event_date ASC
                LIMIT 31`,
            values: [userId],
        };
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in getFamilyCalendar:', error);
        res.status(500).json({ error: error.message });
    }
};
