const pool = require("../config/db");

exports.saveSubscription = async (userId, subscription) => {
    try {
      console.log("Saving subscription for user:", userId);
      console.log("Subscription:", JSON.stringify(subscription));
  
      const query = `
        INSERT INTO push_subscriptions (user_id, endpoint, keys)
        VALUES ($1, $2, $3)
        ON CONFLICT (endpoint) DO UPDATE
        SET keys = $3, updated_at = CURRENT_TIMESTAMP
      `;
      const values = [
        userId,
        subscription.endpoint,
        JSON.stringify(subscription.keys),
      ];
      await pool.query(query, values);
      console.log("Subscription saved successfully");
    } catch (error) {
      console.error("Error saving subscription:", error);
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
      return rows.map((row) => {
        let parsedKeys;
        try {
          parsedKeys = typeof row.keys === 'string' ? JSON.parse(row.keys) : row.keys;
        } catch (parseError) {
          console.error("Error parsing keys:", parseError);
          parsedKeys = {}; // Set a default value or handle the error as needed
        }
        return {
          endpoint: row.endpoint,
          keys: parsedKeys,
        };
      });
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
      console.log(`Removed invalid subscription for user ${userId} with endpoint ${endpoint}`);
    } catch (error) {
      console.error('Error removing invalid subscription:', error);
    }
  };