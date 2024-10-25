// videoWorker.js

require('dotenv').config();
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const os = require('os');
const Queue = require('bull');

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

// Initialize Bull Queue with Redis Cloud
const videoQueue = new Queue('video-compression', process.env.REDIS_CLOUD_URL);

// Video queue processor
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
async function ensureLocalVideo(tempFilePath, key) {
  if (tempFilePath && fs.existsSync(tempFilePath)) {
    return tempFilePath;
  }

  const localPath = path.join(os.tmpdir(), `download-${key}`);
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
