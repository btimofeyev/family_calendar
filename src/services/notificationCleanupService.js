// src/services/notificationCleanupService.js
const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Initialize the notification cleanup service
 * @param {Object} options - Configuration options
 * @param {string} options.schedule - Cron schedule expression (default: midnight every day)
 * @param {number} options.maxAgeDays - Maximum age of notifications to keep in days (default: 14)
 */
function initializeNotificationCleanup(options = {}) {
  const schedule = options.schedule || '0 0 * * *'; // Default: midnight every day
  const maxAgeDays = options.maxAgeDays || 14; // Default: 14 days

  console.log(`Setting up scheduled notification cleanup task...`);
  console.log(`Schedule: ${schedule}`);
  console.log(`Max age: ${maxAgeDays} days`);

  // Schedule the cleanup task
  const job = cron.schedule(schedule, async () => {
    try {
      console.log(`Running notification cleanup (max age: ${maxAgeDays} days)...`);
      
      const result = await pool.query('SELECT cleanup_old_notifications($1)', [maxAgeDays]);
      const deletedCount = result.rows[0].cleanup_old_notifications;
      
      console.log(`Notification cleanup complete. Deleted ${deletedCount} old notifications.`);
    } catch (error) {
      console.error('Error during notification cleanup:', error);
    }
  });

  return job;
}

module.exports = { initializeNotificationCleanup };