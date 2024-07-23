const pool = require('../config/db');

exports.createEvent = async (req, res) => {
    try {
        const { title, event_date, description } = req.body;
        const userId = req.user.id;
        const query = {
            text: `INSERT INTO calendar_events (title, event_date, description, family_id)
                   VALUES ($1, $2, $3, (SELECT family_id FROM users WHERE id = $4))
                   RETURNING *`,
            values: [title, event_date, description, userId],
        };
        const result = await pool.query(query);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = {
            text: `SELECT * FROM calendar_events
                   WHERE family_id = (SELECT family_id FROM users WHERE id = $1)
                   ORDER BY event_date ASC`,
            values: [userId],
        };
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, event_date, description } = req.body;
        const userId = req.user.id;
        const query = {
            text: `UPDATE calendar_events
                   SET title = $1, event_date = $2, description = $3
                   WHERE id = $4 AND family_id = (SELECT family_id FROM users WHERE id = $5)
                   RETURNING *`,
            values: [title, event_date, description, id, userId],
        };
        const result = await pool.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found or you do not have permission to update it' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const query = {
            text: `DELETE FROM calendar_events
                   WHERE id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $2)
                   RETURNING id`,
            values: [id, userId],
        };
        const result = await pool.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found or you do not have permission to delete it' });
        }
        res.json({ message: 'Event deleted successfully', id: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};