// src/videoWorker.js - No Redis dependency

require('dotenv').config();
const { S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const os = require('os');
const cron = require('node-cron');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Cloudflare R2 Client
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Simple in-memory queue for video processing
const videoQueue = [];
let isProcessing = false;

// Helper function for tracking progress
const createProgressTracker = () => {
  const tracker = { 
    progress: 0,
    updateProgress: function(value) {
      this.progress = value;
      console.log(`Processing: ${value}% done`);
    }
  };
  return tracker;
};

// Process videos in the queue one by one
async function processNextVideo() {
  if (isProcessing || videoQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const videoTask = videoQueue.shift();
  const { key } = videoTask;
  const startTime = Date.now();

  try {
    console.log(`Starting compression for video: ${key}`);

    // Check if it's actually a video file
    if (!key.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i)) {
      console.log(`File ${key} does not appear to be a video. Skipping compression.`);
      isProcessing = false;
      processNextVideo(); // Move to next item
      return;
    }

    // Check if already optimized
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
      });
      
      const metadata = await s3Client.send(headCommand);
      if (metadata.Metadata && metadata.Metadata.optimized === 'true') {
        console.log(`Video ${key} is already optimized. Skipping compression.`);
        isProcessing = false;
        processNextVideo(); // Move to next item
        return;
      }
    } catch (error) {
      console.warn(`Error checking if video is already optimized: ${error.message}`);
      // Continue with compression if we can't check
    }

    const workingFilePath = await ensureLocalVideo(null, key);
    const progressTracker = createProgressTracker();
    const compressedFilePath = await compressVideo(workingFilePath, progressTracker);

    // Upload the optimized video back to R2 using the same key
    await uploadOptimizedVideoToR2(key, compressedFilePath);

    // Clean up temporary files
    if (fs.existsSync(workingFilePath)) fs.unlinkSync(workingFilePath);
    if (fs.existsSync(compressedFilePath)) fs.unlinkSync(compressedFilePath);

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Video compression completed in ${processingTime} seconds`);
  } catch (error) {
    console.error(`Video compression failed for ${key}:`, error);
  } finally {
    isProcessing = false;
    processNextVideo(); // Process next item in queue
  }
}

// Helper functions
async function ensureLocalVideo(tempFilePath, key) {
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    return tempFilePath;
  }

  const localPath = path.join(os.tmpdir(), `download-${key.replace(/[\/\\:*?"<>|]/g, '_')}`);
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const writeStream = fs.createWriteStream(localPath);
  await new Promise((resolve, reject) => {
    response.Body.pipe(writeStream)
      .on('finish', resolve)
      .on('error', reject);
  });

  return localPath;
}

async function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      if (!videoStream) return reject(new Error('No video stream found'));
      
      resolve({
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        duration: videoStream.duration || 0,
        bitrate: videoStream.bit_rate || 0
      });
    });
  });
}

async function compressVideo(filePath, progressTracker) {
  const tempOutputPath = path.join(os.tmpdir(), `compressed-${path.basename(filePath)}`);
  let lastProgress = 0;

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
    .outputOptions([
      '-sn',
      '-dn',
      '-map_metadata', '-1',
      '-map 0:v:0',
      '-map 0:a:0?',
      '-map -0:2', // EXCLUDE stream 0:2 specifically!
      '-c:v libx264',
      '-crf 30',
      '-preset faster',
      '-filter:v scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1',
      '-c:a aac',
      '-b:a 96k',
      '-movflags +faststart',
      '-max_muxing_queue_size 9999',
    ])
      .on('start', commandLine => {
        console.log('Spawned ffmpeg with command: ' + commandLine);
      })
      .output(tempOutputPath)
      .on('progress', (progress) => {
        if (progress.percent && progress.percent - lastProgress >= 5) {
          lastProgress = progress.percent;
          progressTracker.updateProgress(Math.min(progress.percent, 100));
        }
      })
      .on('end', () => resolve(tempOutputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}
async function uploadOptimizedVideoToR2(key, filePath) {
  const fileStream = fs.createReadStream(filePath);

  const uploadParams = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: 'video/mp4',
    Metadata: {
      optimized: 'true',
      optimizedAt: new Date().toISOString()
    }
  };

  console.log(`Uploading optimized video with metadata:`, uploadParams.Metadata);

  const upload = new Upload({
    client: s3Client,
    params: uploadParams,
  });

  await upload.done();
  console.log(`Successfully uploaded optimized video: ${key}`);
}

// Function to add a video to the processing queue
function queueVideoCompression(key) {
  // Check if this video is already in the queue
  const alreadyQueued = videoQueue.some(item => item.key === key);
  if (alreadyQueued) {
    console.log(`Video ${key} is already queued for compression. Skipping.`);
    return;
  }

  videoQueue.push({ key });
  console.log(`Added video to compression queue: ${key}`);
  
  // Start processing if not already running
  if (!isProcessing) {
    processNextVideo();
  }
}

// Function to scan for uncompressed videos
async function scanForUncompressedVideos() {
  console.log('Scanning for uncompressed videos...');
  
  try {
    // List all objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
    });
    
    const { Contents } = await s3Client.send(listCommand);
    
    if (!Contents || Contents.length === 0) {
      console.log('No files found in bucket');
      return;
    }
    
    // Filter for video files
    const videoFiles = Contents.filter(item => {
      const key = item.Key;
      return key.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i);
    });
    
    console.log(`Found ${videoFiles.length} video files`);
    
    // Keep track of which videos need processing
    let needsProcessingCount = 0;
    
    // Check each video file for compression metadata
    for (const video of videoFiles) {
      const key = video.Key;
      
      // Get object metadata
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
      });
      
      try {
        const metadata = await s3Client.send(headCommand);
        const fileMetadata = metadata.Metadata || {};
        
        // Check if video is optimized
        const isOptimized = fileMetadata.optimized === 'true';
        
        // We now accept videos of any size since we're compressing them effectively
        const sizeInMB = video.Size / (1024 * 1024);
        
        if (isOptimized) {
          console.log(`Skipping optimized video: ${key}`);
        } else {
          console.log(`Found uncompressed video (${sizeInMB.toFixed(2)}MB): ${key}`);
          needsProcessingCount++;
          
          // Add to compression queue
          queueVideoCompression(key);
        }
      } catch (error) {
        console.warn(`Error checking metadata for ${key}:`, error.message);
      }
    }
    
    console.log(`Found ${needsProcessingCount} videos that need compression`);
    
  } catch (error) {
    console.error('Error scanning for uncompressed videos:', error);
  }
}

// Function to handle upload hook for immediate video compression
function handleNewVideoUpload(key) {
  // Basic validation
  if (!key || typeof key !== 'string') {
    console.error('Invalid key provided to handleNewVideoUpload:', key);
    return;
  }
  
  // Check if it's a video file
  if (!key.match(/\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i)) {
    console.log(`File ${key} is not a video. Skipping compression.`);
    return;
  }
  
  // Queue for compression
  queueVideoCompression(key);
}

// Run scan daily at midnight
cron.schedule('0 0 * * *', scanForUncompressedVideos);

// Also run scan on startup
scanForUncompressedVideos();

console.log('Video compression worker started');

// Export functions for use in other parts of the application
module.exports = {
  handleNewVideoUpload,
  scanForUncompressedVideos
};