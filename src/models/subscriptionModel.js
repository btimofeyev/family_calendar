const pool = require("../config/db");

exports.saveSubscription = async (userId, subscription) => {
	const client = await pool.connect();
	try {
	  await client.query('BEGIN');
	  
	  // Check for an existing subscription with this endpoint
	  const checkQuery = `
		SELECT id FROM push_subscriptions 
		WHERE user_id = $1 AND endpoint = $2
	  `;
	  const checkResult = await client.query(checkQuery, [userId, subscription.endpoint]);
	  
	  if (checkResult.rows.length > 0) {
		// Update existing subscription
		const updateQuery = `
		  UPDATE push_subscriptions 
		  SET p256dh = $1, auth = $2, updated_at = NOW() 
		  WHERE user_id = $3 AND endpoint = $4
		`;
		await client.query(updateQuery, [subscription.keys.p256dh, subscription.keys.auth, userId, subscription.endpoint]);
		console.log(`Updated push subscription for user ${userId}`);
	  } else {
		// Insert new subscription
		const insertQuery = `
		  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		  VALUES ($1, $2, $3, $4)
		`;
		await client.query(insertQuery, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
		console.log(`Created new push subscription for user ${userId}`);
	  }
	  
	  await client.query('COMMIT');
	  return true;
	} catch (error) {
	  await client.query('ROLLBACK');
	  console.error('Error saving push subscription:', error);
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
	  
	  // Format subscriptions as required by web-push library
	  return rows.map(row => ({
		endpoint: row.endpoint,
		keys: {
		  p256dh: row.p256dh,
		  auth: row.auth
		}
	  }));
	} catch (error) {
	  console.error("Error retrieving push subscriptions:", error);
	  return [];
	}
  };
  
  exports.removeInvalidSubscription = async (userId, endpoint) => {
	try {
	  const query = `
		DELETE FROM push_subscriptions
		WHERE user_id = $1 AND endpoint = $2
	  `;
	  await pool.query(query, [userId, endpoint]);
	  console.log(`Removed invalid subscription for user ${userId}`);
	  return true;
	} catch (error) {
	  console.error('Error removing invalid subscription:', error);
	  return false;
	}
  };