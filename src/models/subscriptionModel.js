const pool = require('../config/db');


exports.saveSubscription = async (userId, subscription) => {
    try {
      const query = `
        INSERT INTO push_subscriptions (user_id, endpoint, keys)
        VALUES ($1, $2, $3)
        ON CONFLICT (endpoint) DO NOTHING
      `;
      const values = [userId, subscription.endpoint, JSON.stringify(subscription.keys)];
      await pool.query(query, values);
    } catch (error) {
      console.error('Error saving subscription:', error);
      throw error;
    }
  };


  exports.getUserPushSubscriptions = async (userId) => {
    try {
      const query = `
        SELECT endpoint, keys
        FROM push_subscriptions
        WHERE user_id = $1
      `;
      const { rows } = await pool.query(query, [userId]);
      return rows.map(row => ({
        endpoint: row.endpoint,
        keys: JSON.parse(row.keys)
      }));
    } catch (error) {
      console.error('Error retrieving subscriptions:', error);
      throw error;
    }
  };