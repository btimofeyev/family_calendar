const pool = require('../config/db');

exports.getUserProfile = async(req, res) => {
    try {
        const userId = req.user.id;
        const query = {
            text: 'SELECT id, email, name FROM users WHERE id = $1',
            values: [userId],
        };
        const result = await pool.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};