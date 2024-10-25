require("dotenv").config();
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const sharp = require('sharp');
const Queue = require('bull');

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

// Image compression function
async function compressImage(file) {
  const buffer = await sharp(file.buffer)
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return buffer;
}

// Multer configuration for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  },
});

// Main upload function
async function uploadToR2(file) {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const baseUrl = process.env.R2_CUSTOM_DOMAIN || process.env.R2_BUCKET_URL;

  if (file.mimetype.startsWith('video/')) {
    const filename = `video-${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;

    // Upload original video to R2
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

    // Add video to the processing queue
    await videoQueue.add(
      {
        key: filename,
      },
      {
        priority: 1,
        attempts: 3,
      }
    );

    return `${baseUrl}/${filename}`;
  } else if (file.mimetype.startsWith('image/')) {
    const filename = `image-${file.fieldname}-${uniqueSuffix}.jpg`;
    const buffer = await compressImage(file);

    // Upload compressed image to R2
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

// Function to get the status of the video queue
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

// Function to delete media from R2
async function deleteMediaFromR2(mediaUrl) {
  const filename = mediaUrl.split('/').pop();
  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: filename,
  };

  try {
    await s3Client.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted ${filename} from R2 bucket`);
  } catch (err) {
    console.error('Error deleting media from R2:', err);
    throw err;
  }
}

// Function to get a signed URL for an image
async function getSignedImageUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    throw err;
  }
}

// Export the necessary functions
module.exports = {
  upload,
  uploadToR2,
  getSignedImageUrl,
  deleteMediaFromR2,
  getQueueStatus,
};
