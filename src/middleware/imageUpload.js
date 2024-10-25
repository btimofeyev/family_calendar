require("dotenv").config();
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const Queue = require('bull');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Redis Cloud Configuration
const REDIS_CONFIG = {
  redis: {
    port: process.env.REDIS_CLOUD_PORT,
    host: process.env.REDIS_CLOUD_HOST,
    password: process.env.REDIS_CLOUD_PASSWORD,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    retryStrategy: function(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  },
  limiter: {
    max: 2, 
    duration: 1000, 
  },
  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 2000, 
    },
    removeOnComplete: 100, 
    removeOnFail: 100, 
    timeout: 600000, 
  }
};

// Initialize Bull Queue with Redis Cloud
const videoQueue = new Queue('video-compression', {
  redis: process.env.REDIS_CLOUD_URL 
});
// Cloudflare R2 Client
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Queue event handlers
videoQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

videoQueue.on('waiting', (jobId) => {
  console.log(`Job ${jobId} is waiting to be processed`);
});

videoQueue.on('active', (job) => {
  console.log(`Job ${job.id} has started processing`);
});

videoQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} has been completed`, result);
});

videoQueue.on('failed', (job, error) => {
  console.error(`Job ${job.id} has failed:`, error);
});

videoQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} has stalled`);
});

// Single video queue processor
videoQueue.process(async (job, done) => {
  const { key, tempFilePath } = job.data;
  const startTime = Date.now();

  try {
    await job.progress(0);
    console.log(`Starting compression for video: ${key}`);

    const workingFilePath = await ensureLocalVideo(tempFilePath, key);
    const compressedFilePath = await compressVideo(workingFilePath, job);

    // Upload the optimized video back to R2 using the same key
    await uploadOptimizedVideoToR2(key, compressedFilePath);

    // Clean up temporary files
    if (fs.existsSync(workingFilePath)) fs.unlinkSync(workingFilePath);
    if (fs.existsSync(compressedFilePath)) fs.unlinkSync(compressedFilePath);

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Video compression completed in ${processingTime} seconds`);

    done(null, { 
      success: true, 
      processingTime,
      key
    });
  } catch (error) {
    console.error(`Video compression failed for ${key}:`, error);
    done(error);
  }
});

// Helper functions
async function ensureLocalVideo(tempFilePath, originalKey) {
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    return tempFilePath;
  }

  const localPath = path.join(os.tmpdir(), `download-${originalKey}`);
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: originalKey,
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

async function compressVideo(filePath, job) {
  const tempOutputPath = path.join(os.tmpdir(), `compressed-${path.basename(filePath)}`);
  let lastProgress = 0;

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        '-c:v libx264',
        '-crf 28',
        '-preset faster',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        '-max_muxing_queue_size 9999',
      ])
      .output(tempOutputPath)
      .on('progress', async (progress) => {
        if (progress.percent && progress.percent - lastProgress >= 5) {
          lastProgress = progress.percent;
          await job.progress(Math.min(progress.percent, 100));
          console.log(`Processing: ${progress.percent}% done`);
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

  const upload = new Upload({
    client: s3Client,
    params: uploadParams,
  });

  await upload.done();
}


// Image compression
async function compressImage(file) {
  const buffer = await sharp(file.buffer)
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return buffer;
}

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Main upload function
async function uploadToR2(file) {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const baseUrl = process.env.R2_CUSTOM_DOMAIN;

  if (file.mimetype.startsWith('video/')) {
    const filename = `video-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;

    // Upload original video
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        optimized: 'false',
        uploadTimestamp: Date.now().toString(),
      },
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    await upload.done();

    // Queue video for optimization using the same key
    await videoQueue.add({
      key: filename,
    }, {
      priority: 1,
      attempts: 3,
    });

    // Corrected return statement
    return `${baseUrl}/${filename}`;
  } 
  else if (file.mimetype.startsWith('image/')) {
    const filename = `image-${file.fieldname}-${uniqueSuffix}.jpg`;
    const buffer = await compressImage(file);

    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: 'image/jpeg',
      Metadata: {
        originalName: file.originalname,
        compressed: 'true',
      },
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    await upload.done();
    return `${baseUrl}/${filename}`;
  }

  throw new Error('Unsupported file type');
}

async function getQueueStatus() {
  const [waiting, active, completed, failed] = await Promise.all([
    videoQueue.getWaitingCount(),
    videoQueue.getActiveCount(),
    videoQueue.getCompletedCount(),
    videoQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    timestamp: new Date().toISOString(),
  };
}

async function deleteMediaFromR2(mediaUrl) {
  const filename = mediaUrl.split("/").pop();
  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: filename,
  };

  try {
    await s3Client.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted ${filename} from R2 bucket`);
  } catch (err) {
    console.error("Error deleting media from R2:", err);
    throw err;
  }
}
async function getSignedImageUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return signedUrl;
  } catch (err) {
    console.error("Error generating signed URL:", err);
    throw err;
  }
}

module.exports = {
  upload,
  uploadToR2,
  getSignedImageUrl,
  deleteMediaFromR2,
  videoQueue,
  getQueueStatus,
};