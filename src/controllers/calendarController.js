const pool = require('../config/db');
const notificationController = require('./notificationController');

exports.createEvent = async (req, res) => {
    try {
        const { title, event_date, description, is_recurring } = req.body;
        const userId = req.user.id;

        // Create the event in the database
        const query = {
            text: `INSERT INTO calendar_events (title, event_date, description, family_id, is_recurring, owner_id)
                   VALUES ($1, $2, $3, (SELECT family_id FROM users WHERE id = $4), $5, $4)
                   RETURNING *`,
            values: [title, event_date, description, userId, is_recurring],
        };
        const result = await pool.query(query);
        const event = result.rows[0];

        // Fetch the creator's name
        const userQuery = 'SELECT name FROM users WHERE id = $1';
        const userResult = await pool.query(userQuery, [userId]);
        const userName = userResult.rows[0].name;

        // Format the event date for the notification
        const eventDateFormatted = new Date(event.event_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // Fetch all family members
        const familyQuery = {
            text: `SELECT id FROM users WHERE family_id = (SELECT family_id FROM users WHERE id = $1)`,
            values: [userId],
        };
        const familyResult = await pool.query(familyQuery);
        const familyMembers = familyResult.rows;

        // Send notifications to all family members
        for (const member of familyMembers) {
            if (member.id !== userId) { // Don't send notification to the creator
                await notificationController.createNotification(
                    member.id,
                    'event',
                    `${userName} added a new family event: ${title} on ${eventDateFormatted}`
                );
            }
        }

        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
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
        const { title, event_date, description, is_recurring } = req.body;
        const userId = req.user.id;

        // Ensure the user is the owner of the event
        const ownerCheckQuery = {
            text: `SELECT owner_id FROM calendar_events WHERE id = $1`,
            values: [id],
        };
        const ownerResult = await pool.query(ownerCheckQuery);

        if (ownerResult.rows.length === 0 || ownerResult.rows[0].owner_id !== userId) {
            return res.status(403).json({ error: 'You do not have permission to update this event' });
        }

        const query = {
            text: `UPDATE calendar_events
                   SET title = $1, event_date = $2, description = $3, is_recurring = $4
                   WHERE id = $5 AND owner_id = $6
                   RETURNING *`,
            values: [title, event_date, description, is_recurring, id, userId],
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

        // Ensure the user is the owner of the event
        const ownerCheckQuery = {
            text: `SELECT owner_id FROM calendar_events WHERE id = $1`,
            values: [id],
        };
        const ownerResult = await pool.query(ownerCheckQuery);

        if (ownerResult.rows.length === 0 || ownerResult.rows[0].owner_id !== userId) {
            return res.status(403).json({ error: 'You do not have permission to delete this event' });
        }

        const query = {
            text: `DELETE FROM calendar_events
                   WHERE id = $1 AND owner_id = $2
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