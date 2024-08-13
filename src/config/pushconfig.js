const webpush = require('web-push');
const dotenv = require('dotenv');

dotenv.config();

webpush.setVapidDetails(
  'mailto:famlynook@famlynook.com', 
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = webpush;
