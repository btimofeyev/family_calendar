// src/middleware/imageUpload.js 
require("dotenv").config();
const { S3Client, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const path = require("path");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const sharp = require('sharp');
const videoWorker = require('../videoWorker');

const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function compressImage(file, options = {}) {
  const opts = {
    maxWidth: options.maxWidth || 1920,
    maxHeight: options.maxHeight || 1080,
    quality: options.quality || 80,
    format: options.format || 'jpeg'
  };

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
  
  return file.buffer;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    files: 4
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

async function uploadToR2(file, context = null, attempts = 3) {
  let buffer = file.buffer;
  let contentType = file.mimetype;
  let attempt = 0;

  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const extension = file.mimetype.startsWith('image/') ? 'jpg' : path.extname(file.originalname || 'file.unknown').split('.').pop();
  
  const filename = `pending/${Date.now()}-${uniqueSuffix}.${extension}`;

  while (attempt < attempts) {
    try {
      attempt++;

      if (file.mimetype.startsWith('image/')) {
        buffer = await compressImage(file);
        contentType = 'image/jpeg';
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

      if (file.mimetype.startsWith('video/')) {
        videoWorker.handleNewVideoUpload(filename);
      }

      const baseUrl = process.env.R2_CUSTOM_DOMAIN;
      return `${baseUrl}/${filename}`;
    } catch (err) {
      if (attempt >= attempts) {
        throw new Error(`Failed to upload file after ${attempts} attempts: ${err.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}

async function deleteMediaFromR2(mediaUrl, attempts = 3) {
  if (!mediaUrl) {
    return;
  }

  let filename;
  if (mediaUrl.startsWith('http')) {
    const customDomain = process.env.R2_CUSTOM_DOMAIN;
    if (customDomain && mediaUrl.includes(customDomain)) {
      const urlObj = new URL(mediaUrl);
      filename = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
    } else {
      filename = mediaUrl.split("/").pop();
    }
  } else {
    filename = mediaUrl;
  }

  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: filename,
  };

  let attempt = 0;
  while (attempt < attempts) {
    try {
      attempt++;
      
      await s3Client.send(new DeleteObjectCommand(params));
      return;
    } catch (err) {
      if (attempt >= attempts) {
        throw new Error(`Failed to delete file after ${attempts} attempts: ${err.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
}

async function batchDeleteFromR2(mediaUrls) {
  if (!mediaUrls || !Array.isArray(mediaUrls)) {
    return;
  }

  const validUrls = mediaUrls.filter(url => url);
  
  const results = await Promise.allSettled(
    validUrls.map(url => deleteMediaFromR2(url))
  );
  
  return results;
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
    throw err;
  }
}

async function getSignedImageUrls(keys) {
  if (!keys || !Array.isArray(keys)) {
    return [];
  }
  
  const validKeys = keys.filter(key => key);
  
  const results = await Promise.allSettled(
    validKeys.map(key => getSignedImageUrl(key))
  );
  
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

const MAX_PROMOTE_RETRY = 5;

function promotePendingToComplete(pendingUrlOrKey) {
  const base = process.env.R2_CUSTOM_DOMAIN;
  const oldKey = pendingUrlOrKey.startsWith('http')
               ? pendingUrlOrKey.replace(base + '/', '')
               : pendingUrlOrKey;

  if (!oldKey.startsWith('pending/')) {
    return { oldKey, newKey: oldKey, url: `${base}/${oldKey}` };
  }

  const newKey = oldKey.replace(/^pending\//, 'complete/');
  const newUrl = `${base}/${newKey}`;

  (async () => {
    for (let attempt = 1; attempt <= MAX_PROMOTE_RETRY; attempt++) {
      try {
        await s3Client.send(new CopyObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          CopySource: `${process.env.R2_BUCKET_NAME}/${oldKey}`,
          Key: newKey,
          MetadataDirective: 'COPY'
        }));

        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: oldKey
        }));

        return;
      } catch (err) {
        if (err.Code !== 'NoSuchKey') {
          return;
        }

        const wait = 300 * attempt;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  })();

  return { oldKey, newKey, url: newUrl };
}

module.exports = {
  upload,
  uploadToR2,
  getSignedImageUrl,
  getSignedImageUrls,
  deleteMediaFromR2,
  batchDeleteFromR2,
  compressImage,
  promotePendingToComplete,
};