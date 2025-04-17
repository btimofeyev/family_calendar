// server.js - Update to include new media routes
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
const mediaRoutes = require('./src/routes/mediaRoutes'); // Add new import
require('./src/videoWorker');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server); 

const PORT = process.env.PORT || 3001;

// Increase payload size limit 
// Note: With presigned uploads, we only need large limits for JSON metadata, not for file uploads
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// Add cookie parser middleware
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files (legacy - new files go directly to R2)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add CORS headers for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', socialFeedRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/media', mediaRoutes); // Add new routes

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on all interfaces`);
});