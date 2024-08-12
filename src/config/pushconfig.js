const webpush = require('web-push');
const dotenv = require('dotenv');

dotenv.config();

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,  
  privateKey: process.env.VAPID_PRIVATE_KEY 
};

webpush.setVapidDetails(
  'mailto:famlynook@famlynook.com', 
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

module.exports = webpush;
