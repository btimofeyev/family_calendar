//src/controllers/mediaController.js
const pool = require("../config/db");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');
const videoWorker = require('../videoWorker');

// Create S3 client with R2 configuration
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

exports.getPresignedUploadUrl = async (req, res) => {
  const userId = req.user.id;
  const { contentType, filename, fileSize, memoryId, postId } = req.body;
  
  if (!contentType || !filename) {
    return res.status(400).json({ error: "Content type and filename are required" });
  }

  try {
    if (fileSize) {
      const fileSizeMB = parseInt(fileSize) / (1024 * 1024);
      const maxSizeMB = process.env.MAX_UPLOAD_SIZE_MB || 500;
      
      if (fileSizeMB > maxSizeMB) {
        return res.status(400).json({ 
          error: `File size exceeds maximum allowed (${maxSizeMB}MB)`,
          code: 'FILE_TOO_LARGE' 
        });
      }
    }

    const fileExt = filename.split('.').pop().toLowerCase();
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const context = memoryId ? `memory_${memoryId}` : (postId ? `post_${postId}` : 'general');
    const key = `pending/${userId}/${Date.now()}-${uniqueId}.${fileExt}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: {
        userId: userId.toString(),
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
        memoryId: memoryId ? memoryId.toString() : '',
        postId: postId ? postId.toString() : '',
        context: context
      }
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 1800
    });

    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.R2_CUSTOM_DOMAIN 
      : process.env.R2_BUCKET_URL;
      
    const fileUrl = `${baseUrl}/${key}`;

    const insertQuery = {
      text: `INSERT INTO media_uploads 
             (user_id, object_key, content_type, original_filename, file_url, status, 
              memory_id, post_id, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW())
             RETURNING id`,
      values: [userId, key, contentType, filename, fileUrl, memoryId || null, postId || null]
    };
    
    const dbResult = await pool.query(insertQuery);
    const uploadId = dbResult.rows[0].id;

    res.json({
      presignedUrl,
      uploadId,
      key,
      fileUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

exports.confirmUpload = async (req, res) => {
  const userId = req.user.id;
  const { uploadId, key, memoryId, postId } = req.body;
  
  if (!uploadId || !key) {
    return res.status(400).json({ error: "Upload ID and key are required" });
  }

  try {
    const verifyQuery = {
      text: `SELECT * FROM media_uploads 
             WHERE id = $1 AND user_id = $2 AND object_key = $3`,
      values: [uploadId, userId, key]
    };
    
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: "Upload not found or not authorized" });
    }
    
    const upload = verifyResult.rows[0];
    
    const updateValues = [uploadId];
    updateValues.push(memoryId || null);
    updateValues.push(postId || null);
    
    const result = await pool.query(
      `UPDATE media_uploads 
       SET status = 'completed', updated_at = NOW(),
       memory_id = COALESCE($2, memory_id),
       post_id = COALESCE($3, post_id)
       WHERE id = $1
       RETURNING *`, 
      updateValues
    );
    
    if (memoryId) {
      try {
        const memoryContentQuery = {
          text: `INSERT INTO memory_content 
                 (memory_id, user_id, file_path, content_type, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 RETURNING *`,
          values: [memoryId, userId, upload.file_url, upload.content_type]
        };
        
        await pool.query(memoryContentQuery);
      } catch (memoryError) {
        // Continue anyway as the file is uploaded successfully
      }
    }
    
    if (upload.content_type.startsWith('video/')) {
      videoWorker.handleNewVideoUpload(key);
    }
    
    res.json({
      message: 'Upload confirmed successfully',
      upload: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
};

exports.cancelUpload = async (req, res) => {
  const userId = req.user.id;
  const { uploadId, key } = req.body;
  
  if (!uploadId || !key) {
    return res.status(400).json({ error: "Upload ID and key are required" });
  }

  try {
    const verifyQuery = {
      text: `SELECT * FROM media_uploads 
             WHERE id = $1 AND user_id = $2 AND object_key = $3`,
      values: [uploadId, userId, key]
    };
    
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: "Upload not found or not authorized" });
    }
    
    const updateQuery = {
      text: `UPDATE media_uploads 
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1`,
      values: [uploadId]
    };
    
    await pool.query(updateQuery);
    
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
      });
      
      await s3Client.send(deleteCommand);
    } catch (deleteError) {
      // Continue even if delete fails
    }
    
    res.json({
      message: 'Upload cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel upload' });
  }
};

exports.cleanupPendingUploads = async (req, res) => {
  try {
    const findQuery = {
      text: `SELECT id, object_key, file_url
             FROM media_uploads  
             WHERE object_key LIKE 'pending/%'
             AND post_id  IS NULL
             AND memory_id IS NULL
             AND created_at < NOW() - INTERVAL '30 minutes'`
    };
    
    const { rows } = await pool.query(findQuery);
    
    if (rows.length === 0) {
      return res.json({ message: 'No unused uploads to clean up' });
    }
    
    let deletedCount = 0;
    let failedDeletions = [];
    
    for (const upload of rows) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: upload.object_key
        });
        
        await s3Client.send(deleteCommand);
        
        await pool.query(
          `DELETE FROM media_uploads WHERE id = $1`,
          [upload.id]
        );
        
        deletedCount++;
      } catch (error) {
        failedDeletions.push({
          id: upload.id,
          key: upload.object_key,
          error: error.message
        });
      }
    }
    
    res.json({ 
      message: `Deleted ${deletedCount} of ${rows.length} unused uploads`,
      failedDeletions: failedDeletions.length > 0 ? failedDeletions : undefined
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run cleanup process' });
  }
};