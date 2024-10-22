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

ffmpeg.setFfmpegPath(ffmpegPath);

// AWS S3 Client
/*
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
*/

// Cloudflare R2 Client
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto", // Use 'auto' as the region for R2
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function compressVideo(file) {
  const tempInputPath = path.join(os.tmpdir(), file.originalname);
  const tempOutputPath = path.join(os.tmpdir(), `compressed-${file.originalname}`);

  await fs.promises.writeFile(tempInputPath, file.buffer);

  return new Promise((resolve, reject) => {
    ffmpeg(tempInputPath)
      .outputOptions([
        '-c:v libx264',
        '-crf 28',
        '-preset faster',
        '-c:a aac',
        '-b:a 128k'
      ])
      .output(tempOutputPath)
      .on('end', async () => {
        const compressedBuffer = await fs.promises.readFile(tempOutputPath);
        await fs.promises.unlink(tempInputPath);
        await fs.promises.unlink(tempOutputPath);
        resolve(compressedBuffer);
      })
      .on('error', (err) => {
        reject(err);
      })
      .run();
  });
}


async function compressImage(file) {
  const buffer = await sharp(file.buffer)
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return buffer;
}

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

// AWS S3 Upload
/*
async function uploadToS3(file) {
  let buffer = file.buffer;
  let contentType = file.mimetype;

  if (file.mimetype.startsWith('video/')) {
    buffer = await compressVideo(file);
  } else if (file.mimetype.startsWith('image/')) {
    buffer = await compressImage(file);
    contentType = 'image/jpeg'; // We're converting all images to JPEG
  }

  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = file.fieldname + "-" + uniqueSuffix + (file.mimetype.startsWith('image/') ? '.jpg' : path.extname(file.originalname));

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: contentType
  };

  const upload = new Upload({
    client: s3Client,
    params: uploadParams
  });

  await upload.done();

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
}
*/  

// Cloudflare R2 Upload
async function uploadToR2(file) {
  let buffer = file.buffer;
  let contentType = file.mimetype;

  // Compress the media file (images and videos)
  if (file.mimetype.startsWith('video/')) {
    buffer = await compressVideo(file);
  } else if (file.mimetype.startsWith('image/')) {
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

  // Use custom domain for production, else use the direct R2 bucket URL for development
  const baseUrl = process.env.R2_CUSTOM_DOMAIN;  // Always use the custom domain
  return `${baseUrl}/${filename}`;
}
async function deleteMediaFromR2(mediaUrl) {
  const filename = mediaUrl.split("/").pop(); // Extract the file key from the media URL
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
// AWS S3 Media Deletion
/*
async function deleteMediaFromS3(mediaUrl) {
  const filename = mediaUrl.split("/").pop();
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
  };
  try {
    await s3Client.send(new DeleteObjectCommand(params));
  } catch (err) {
    console.error("Error deleting media from S3:", err);
    throw err;
  }
}
*/

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
  // deleteMediaFromS3, // AWS-specific deletion, can comment out or refactor for R2
  getSignedImageUrl,
  deleteMediaFromR2,
};
