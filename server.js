const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); 
const http = require('http');
const { initializeSocket } = require('./src/middleware/socket'); 
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const socialFeedRoutes = require('./src/routes/socialFeedRoutes');
const invitationRoutes = require('./src/routes/invitationRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const memoriesRoutes = require('./src/routes/memoriesRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const { initializeNotificationCleanup } = require('./src/services/notificationCleanupService');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server); 

const PORT = process.env.PORT || 3001;

// Increase payload size limit (adjust the limit as needed)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Add cookie parser middleware
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', socialFeedRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/account', accountRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on all interfaces`);

  const cleanupJob = initializeNotificationCleanup({
    // Customize if needed, or use defaults
    schedule: '0 0 * * *', // Run at midnight every day 
    maxAgeDays: 14 // Keep notifications for 14 days
  });
});