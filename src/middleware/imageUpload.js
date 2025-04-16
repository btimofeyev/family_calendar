// src/middleware/imageUpload.js - Updated for multiple media uploads
require("dotenv").config();
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const sharp = require('sharp');
const videoWorker = require('../videoWorker');

// AWS S3 or Cloudflare R2 Client
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto", // Use 'auto' as the region for R2
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Compress Image Function - Now processes multiple sizes
async function compressImage(file, options = {}) {
  // Default options
  const opts = {
    maxWidth: options.maxWidth || 1920,
    maxHeight: options.maxHeight || 1080,
    quality: options.quality || 80,
    format: options.format || 'jpeg'
  };

  // Process based on mime type
  if (file.mimetype.startsWith('image/')) {
    const buffer = await sharp(file.buffer)
      .resize({
        width: opts.maxWidth,
        height: opts.maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: opts.quality })
      .toBuffer();

    return buffer;
  }
  
  // Return original buffer for non-image files
  return file.buffer;
}

// Enhanced Multer configuration for multiple file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50 MB file size limit
    files: 4 // Maximum of 4 files per upload
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Improved R2 upload function with retry logic
async function uploadToR2(file, attempts = 3) {
  let buffer = file.buffer;
  let contentType = file.mimetype;
  let attempt = 0;

  // Generate a unique filename
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const extension = file.mimetype.startsWith('image/') ? 'jpg' : path.extname(file.originalname || 'file.unknown').split('.').pop();
  const filename = `${file.fieldname || 'media'}-${uniqueSuffix}.${extension}`;

  while (attempt < attempts) {
    try {
      attempt++;
      console.log(`Upload attempt ${attempt} for ${filename}`);

      // Compress image if it's an image file
      if (file.mimetype.startsWith('image/')) {
        buffer = await compressImage(file);
        contentType = 'image/jpeg'; // Convert images to JPEG format
      }

      const uploadParams = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
      };

      const upload = new Upload({
        client: s3Client,
        params: uploadParams,
      });

      await upload.done();

      // Check if this is a video file and queue it for compression
      if (file.mimetype.startsWith('video/')) {
        // Add to video compression queue
        console.log(`Queueing video for compression: ${filename}`);
        videoWorker.handleNewVideoUpload(filename);
      }

      // Use custom domain for production
      const baseUrl = process.env.R2_CUSTOM_DOMAIN;
      console.log(`Upload successful for ${filename}`);
      return `${baseUrl}/${filename}`;
    } catch (err) {
      console.error(`Upload attempt ${attempt} failed for ${filename}:`, err);
      
      if (attempt >= attempts) {
        throw new Error(`Failed to upload file after ${attempts} attempts: ${err.message}`);
      }
      
      // Wait before next attempt (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}

// Delete Media from R2 with retry logic
async function deleteMediaFromR2(mediaUrl, attempts = 3) {
  if (!mediaUrl) {
    console.warn("Attempted to delete undefined or null mediaUrl");
    return;
  }

  const filename = mediaUrl.split("/").pop();
  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: filename,
  };

  let attempt = 0;
  while (attempt < attempts) {
    try {
      attempt++;
      console.log(`Delete attempt ${attempt} for ${filename}`);
      
      await s3Client.send(new DeleteObjectCommand(params));
      console.log(`Successfully deleted ${filename} from R2 bucket`);
      return;
    } catch (err) {
      console.error(`Delete attempt ${attempt} failed for ${filename}:`, err);
      
      if (attempt >= attempts) {
        throw new Error(`Failed to delete file after ${attempts} attempts: ${err.message}`);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}

// Batch delete multiple media files from R2
async function batchDeleteFromR2(mediaUrls) {
  if (!mediaUrls || !Array.isArray(mediaUrls)) {
    console.warn("Invalid media URLs provided for batch delete");
    return;
  }

  // Filter out any null/undefined URLs
  const validUrls = mediaUrls.filter(url => url);
  
  // Process deletions in parallel with a limit
  const results = await Promise.allSettled(
    validUrls.map(url => deleteMediaFromR2(url))
  );
  
  // Log results
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Batch delete completed: ${succeeded} succeeded, ${failed} failed`);
  
  // Return results for potential retry
  return results;
}

// Cloudflare R2 Signed URL Generation
async function getSignedImageUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // URL expires in 1 hour
    return signedUrl;
  } catch (err) {
    console.error("Error generating signed URL:", err);
    throw err;
  }
}

// Get multiple signed URLs in batch
async function getSignedImageUrls(keys) {
  if (!keys || !Array.isArray(keys)) {
    return [];
  }
  
  const validKeys = keys.filter(key => key);
  
  // Process in parallel with a limit
  const results = await Promise.allSettled(
    validKeys.map(key => getSignedImageUrl(key))
  );
  
  // Extract the successful results
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

module.exports = {
  upload,
  uploadToR2,
  getSignedImageUrl,
  getSignedImageUrls,
  deleteMediaFromR2,
  batchDeleteFromR2,
  compressImage
};