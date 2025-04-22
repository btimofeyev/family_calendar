// server.js - Update to include new media routes and cleanup functionality
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); 
const http = require('http');
const cron = require('node-cron');
const { S3Client, DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const pool = require('./src/config/db');

// Import controllers, middleware and routes
const { initializeSocket } = require('./src/middleware/socket'); 
const authRoutes = require('./src/routes/authRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const socialFeedRoutes = require('./src/routes/socialFeedRoutes');
const invitationRoutes = require('./src/routes/invitationRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const memoriesRoutes = require('./src/routes/memoriesRoutes');
const accountRoutes = require('./src/routes/accountRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');
const mediaController = require('./src/controllers/mediaController');

// Initialize video processing
require('./src/videoWorker');

// Load environment variables
dotenv.config();

// Create S3/R2 client
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = initializeSocket(server); 

const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS for development
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
app.use('/api/media', mediaRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const cleanupSchedule = process.env.NODE_ENV === 'production' 
  ? '*/30 * * * *'  
  : '*/5 * * * *';  

cron.schedule(cleanupSchedule, async () => {
  console.log('Running cleanup for stale media uploads...');
  try {
    // Create a mock request/response
    const req = {};
    const res = {
      json: (data) => console.log('Cleanup result:', data),
      status: (code) => ({ json: (data) => console.error(`Cleanup error (${code}):`, data) })
    };
    
    await mediaController.cleanupPendingUploads(req, res);
  } catch (error) {
    console.error('Failed to run media cleanup job:', error);
  }
});

// Run deep cleanup once a day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running deep cleanup for orphaned media files...');
  try {
    // Get all files from R2
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
    });
    
    const { Contents } = await s3Client.send(listCommand);
    
    if (!Contents || Contents.length === 0) {
      console.log('No files found in bucket');
      return;
    }
    
    console.log(`Found ${Contents.length} total files in R2 bucket`);
    
    // Get all known object keys from the database
    const dbKeysQuery = await pool.query(`
      SELECT object_key FROM media_uploads
      UNION
      SELECT DISTINCT file_path as object_key FROM memory_content
      UNION
      SELECT DISTINCT unnest(media_urls) as object_key FROM posts WHERE media_urls IS NOT NULL
    `);
    
    const knownKeys = new Set(dbKeysQuery.rows.map(row => row.object_key));
    console.log(`Found ${knownKeys.size} known keys in database`);
    
    // Find orphaned files (in R2 but not in database)
    const orphanedFiles = Contents
      .filter(obj => obj.Key.startsWith('pending/'))
      .filter(obj => !knownKeys.has(obj.Key));
    console.log(`Found ${orphanedFiles.length} orphaned files in R2 to clean up`);
    
    // Delete orphaned files
    let deletedCount = 0;
    for (const file of orphanedFiles) {
      try {
        // Skip metadata files or system files
        if (file.Key.includes('.ds_store') || file.Key.includes('metadata')) {
          continue;
        }
        
        console.log(`Deleting orphaned file: ${file.Key}`);
        
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: file.Key
        });
        
        await s3Client.send(deleteCommand);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting orphaned file ${file.Key}:`, error);
      }
    }
    
    console.log(`Successfully deleted ${deletedCount} orphaned files`);
  } catch (error) {
    console.error('Failed to run deep cleanup job:', error);
  }
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} on all interfaces`);
});