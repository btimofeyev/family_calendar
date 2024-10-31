require("dotenv").config();
const { S3Client, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');

// AWS S3 or Cloudflare R2 Client
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto", // Use 'auto' as the region for R2
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// Compress Image Function
async function compressImage(file) {
  const buffer = await sharp(file.buffer)
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return buffer;
}

// Multer Setup for Memory Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB file size limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

// Cloudflare R2 Upload
async function uploadToR2(file) {
  let buffer = file.buffer;
  let contentType = file.mimetype;

  // Only compress images
  if (file.mimetype.startsWith('image/')) {
    buffer = await compressImage(file);
    contentType = 'image/jpeg'; // Convert images to JPEG format
  }

  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `${file.fieldname}-${uniqueSuffix}.${file.mimetype.startsWith('image/') ? 'jpg' : path.extname(file.originalname)}`;

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

  // Use custom domain for production
  const baseUrl = process.env.R2_CUSTOM_DOMAIN;
  return `${baseUrl}/${filename}`;
}

// Delete Media from R2
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

module.exports = {
  upload,
  uploadToR2,
  getSignedImageUrl,
  deleteMediaFromR2,
};
