require('dotenv').config();
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function listAllObjects() {
  const objects = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET_NAME,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    objects.push(...response.Contents);
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

async function getObjectFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  return response.Body;
}

async function compressImage(buffer) {
  return sharp(buffer)
    .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function compressVideo(buffer, key) {
  const tempInputPath = path.join(os.tmpdir(), key);
  const tempOutputPath = path.join(os.tmpdir(), `compressed-${key}`);

  await fs.promises.writeFile(tempInputPath, buffer);

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

async function uploadCompressedObject(key, buffer, contentType) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
  });

  await upload.done();
}

async function processObject(object) {
  const key = object.Key;
  const contentType = object.ContentType;

  console.log(`Processing: ${key}`);

  const objectBody = await getObjectFromS3(key);
  const buffer = await objectBody.transformToByteArray();

  let compressedBuffer;
  if (contentType.startsWith('image/')) {
    compressedBuffer = await compressImage(buffer);
  } else if (contentType.startsWith('video/')) {
    compressedBuffer = await compressVideo(buffer, key);
  } else {
    console.log(`Skipping non-media file: ${key}`);
    return;
  }

  await uploadCompressedObject(key, compressedBuffer, contentType);
  console.log(`Compressed and replaced: ${key}`);
}

async function main() {
  try {
    const objects = await listAllObjects();
    for (const object of objects) {
      await processObject(object);
    }
    console.log('All objects processed successfully');
  } catch (error) {
    console.error('Error processing objects:', error);
  }
}

main();