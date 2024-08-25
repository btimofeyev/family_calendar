const pool = require('../config/db');
const notificationController = require('./notificationController');

exports.createEvent = async (req, res) => {
    try {
        const { title, event_date, description, is_recurring, family_id, type } = req.body;
        const userId = req.user.id;

        // Verify that the user is part of the specified family
        const familyCheckQuery = {
            text: `SELECT 1 FROM user_families WHERE user_id = $1 AND family_id = $2`,
            values: [userId, family_id],
        };
        const familyCheckResult = await pool.query(familyCheckQuery);
        
        if (familyCheckResult.rows.length === 0) {
            return res.status(403).json({ error: 'You do not have permission to create an event for this family' });
        }

        // Create the event in the database
        const query = {
            text: `INSERT INTO calendar_events (title, event_date, description, family_id, is_recurring, owner_id, type)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING *`,
            values: [title, event_date, description, family_id, is_recurring, userId, type],
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
            text: `SELECT user_id FROM user_families WHERE family_id = $1`,
            values: [family_id],
        };
        const familyResult = await pool.query(familyQuery);
        const familyMembers = familyResult.rows;

        // Send notifications to all family members
        for (const member of familyMembers) {
            if (member.user_id !== userId) { // Don't send notification to the creator
                await notificationController.createNotification(
                    member.user_id,
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
        const { familyId } = req.params;
        const query = {
            text: `SELECT * FROM calendar_events
                   WHERE family_id = $1
                   ORDER BY event_date ASC`,
            values: [familyId],
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
        const { title, event_date, description, is_recurring, type } = req.body;
        const userId = req.user.id;

        // Ensure the user is the owner of the event
        const ownerCheckQuery = {
            text: `SELECT owner_id, family_id FROM calendar_events WHERE id = $1`,
            values: [id],
        };
        const ownerResult = await pool.query(ownerCheckQuery);

        if (ownerResult.rows.length === 0 || ownerResult.rows[0].owner_id !== userId) {
            return res.status(403).json({ error: 'You do not have permission to update this event' });
        }

        const query = {
            text: `UPDATE calendar_events
                   SET title = $1, event_date = $2, description = $3, is_recurring = $4, type = $5
                   WHERE id = $6 AND owner_id = $7
                   RETURNING *`,
            values: [title, event_date, description, is_recurring, type, id, userId],
        };
        const result = await pool.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found or you do not have permission to update it' });
        }

        const updatedEvent = result.rows[0];

        // Fetch the updater's name
        const userQuery = 'SELECT name FROM users WHERE id = $1';
        const userResult = await pool.query(userQuery, [userId]);
        const userName = userResult.rows[0].name;

        // Format the event date for the notification
        const eventDateFormatted = new Date(updatedEvent.event_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // Fetch all family members
        const familyQuery = {
            text: `SELECT user_id FROM user_families WHERE family_id = $1`,
            values: [updatedEvent.family_id],
        };
        const familyResult = await pool.query(familyQuery);
        const familyMembers = familyResult.rows;

        // Send notifications to all family members
        for (const member of familyMembers) {
            if (member.user_id !== userId) { // Don't send notification to the updater
                await notificationController.createNotification(
                    member.user_id,
                    'event',
                    `${userName} updated a family event: ${updatedEvent.title} on ${eventDateFormatted}`
                );
            }
        }

        res.json(updatedEvent);
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