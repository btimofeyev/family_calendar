const pool = require("../config/db");

exports.saveSubscription = async (userId, subscription) => {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const query = `
			INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, endpoint) DO UPDATE
			SET p256dh = $3, auth = $4
		`;
		await client.query(query, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
};

exports.getUserPushSubscriptions = async (userId) => {
	try {
		const query = `
			SELECT endpoint, p256dh, auth
			FROM push_subscriptions
			WHERE user_id = $1
		`;
		const { rows } = await pool.query(query, [userId]);
		return rows.map(row => ({
			endpoint: row.endpoint,
			keys: {
				p256dh: row.p256dh,
				auth: row.auth
			}
		}));
	} catch (error) {
		console.error("Error retrieving push subscriptions:", error);
		throw error;
	}
};

exports.removeInvalidSubscription = async (userId, endpoint) => {
	try {
		const query = `
			DELETE FROM push_subscriptions
			WHERE user_id = $1 AND endpoint = $2
		`;
		await pool.query(query, [userId, endpoint]);
	} catch (error) {
		console.error('Error removing invalid subscription:', error);
	}
};