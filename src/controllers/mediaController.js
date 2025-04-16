// src/controllers/mediaController.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');
const pool = require("../config/db");
const videoWorker = require('../videoWorker');

// Create S3 client with R2 configuration
const s3Client = new S3Client({
  endpoint: process.env.R2_BUCKET_URL,
  region: "auto", // Use 'auto' as the region for R2
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a presigned upload URL for direct client->R2 uploads
 */
exports.getPresignedUploadUrl = async (req, res) => {
  const userId = req.user.id;
  const { contentType, filename, fileSize } = req.body;
  
  if (!contentType || !filename) {
    return res.status(400).json({ error: "Content type and filename are required" });
  }

  try {
    // Validate file size if provided
    if (fileSize) {
      const fileSizeMB = parseInt(fileSize) / (1024 * 1024);
      // Set a reasonable upper limit (e.g., 500MB)
      const maxSizeMB = process.env.MAX_UPLOAD_SIZE_MB || 500;
      
      if (fileSizeMB > maxSizeMB) {
        return res.status(400).json({ 
          error: `File size exceeds maximum allowed (${maxSizeMB}MB)`,
          code: 'FILE_TOO_LARGE' 
        });
      }
    }

    // Generate unique key for the file
    const fileExt = filename.split('.').pop().toLowerCase();
    
    // Include user ID in the path for organization and security
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const key = `uploads/${userId}/${Date.now()}-${uniqueId}.${fileExt}`;
    
    // Create command for presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // Add additional metadata
      Metadata: {
        userId: userId.toString(),
        originalFilename: filename,
        uploadedAt: new Date().toISOString()
      }
    });

    // Generate the presigned URL (expires in 30 minutes)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 1800 // 30 minutes
    });

    // Get base URL for the file (for reference after upload)
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.R2_CUSTOM_DOMAIN 
      : process.env.R2_BUCKET_URL;
      
    const fileUrl = `${baseUrl}/${key}`;

    // Store upload request in database for tracking
    const insertQuery = {
      text: `INSERT INTO media_uploads 
             (user_id, object_key, content_type, original_filename, file_url, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
             RETURNING id`,
      values: [userId, key, contentType, filename, fileUrl]
    };
    
    const dbResult = await pool.query(insertQuery);
    const uploadId = dbResult.rows[0].id;

    // Return both the URL and the key to the client
    res.json({
      presignedUrl,
      uploadId,
      key,
      fileUrl
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
};

/**
 * Confirm that a file was successfully uploaded via presigned URL
 */
exports.confirmUpload = async (req, res) => {
  const userId = req.user.id;
  const { uploadId, key } = req.body;
  
  if (!uploadId || !key) {
    return res.status(400).json({ error: "Upload ID and key are required" });
  }

  try {
    // Verify the upload exists and belongs to the user
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
    
    // Update the upload status to 'completed'
    const updateQuery = {
      text: `UPDATE media_uploads 
             SET status = 'completed', updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
      values: [uploadId]
    };
    
    const result = await pool.query(updateQuery);
    
    // Check if this is a video and needs processing
    if (upload.content_type.startsWith('video/')) {
      // Queue video for processing
      videoWorker.handleNewVideoUpload(key);
    }
    
    // Return the file URL and updated upload info
    res.json({
      message: 'Upload confirmed successfully',
      upload: result.rows[0]
    });
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
};

/**
 * Add uploaded media to a specific memory
 */
exports.addMediaToMemory = async (req, res) => {
  const userId = req.user.id;
  const { memoryId } = req.params;
  const { uploadId, key } = req.body;
  
  if (!memoryId || !uploadId || !key) {
    return res.status(400).json({ 
      error: "Memory ID, upload ID, and file key are required" 
    });
  }

  try {
    // Verify the upload exists and belongs to the user
    const uploadQuery = {
      text: `SELECT * FROM media_uploads 
             WHERE id = $1 AND user_id = $2 AND object_key = $3`,
      values: [uploadId, userId, key]
    };
    
    const uploadResult = await pool.query(uploadQuery);
    
    if (uploadResult.rows.length === 0) {
      return res.status(404).json({ error: "Upload not found or not authorized" });
    }
    
    const upload = uploadResult.rows[0];
    
    // Verify the memory exists and user has access
    const memoryQuery = {
      text: `SELECT m.* FROM memories m
             JOIN user_families uf ON m.family_id = uf.family_id
             WHERE m.memory_id = $1 AND uf.user_id = $2`,
      values: [memoryId, userId]
    };
    
    const memoryResult = await pool.query(memoryQuery);
    
    if (memoryResult.rows.length === 0) {
      return res.status(404).json({ 
        error: "Memory not found or you don't have access to it" 
      });
    }
    
    // Add media to memory_content
    const insertQuery = {
      text: `INSERT INTO memory_content
             (memory_id, user_id, file_path, content_type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
      values: [memoryId, userId, upload.file_url, upload.content_type]
    };
    
    const result = await pool.query(insertQuery);
    
    // Return the newly added content
    res.status(201).json({
      message: 'Media added to memory successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding media to memory:', error);
    res.status(500).json({ error: 'Failed to add media to memory' });
  }
};

/**
 * Cancel an upload and delete the file if it exists
 */
exports.cancelUpload = async (req, res) => {
  const userId = req.user.id;
  const { uploadId, key } = req.body;
  
  if (!uploadId || !key) {
    return res.status(400).json({ error: "Upload ID and key are required" });
  }

  try {
    // Verify the upload exists and belongs to the user
    const verifyQuery = {
      text: `SELECT * FROM media_uploads 
             WHERE id = $1 AND user_id = $2 AND object_key = $3`,
      values: [uploadId, userId, key]
    };
    
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: "Upload not found or not authorized" });
    }
    
    // Update the upload status to 'cancelled'
    const updateQuery = {
      text: `UPDATE media_uploads 
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1`,
      values: [uploadId]
    };
    
    await pool.query(updateQuery);
    
    // Try to delete the file from R2
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key
      });
      
      await s3Client.send(deleteCommand);
    } catch (deleteError) {
      console.error('Error deleting file:', deleteError);
      // Continue even if delete fails
    }
    
    // Return success
    res.json({
      message: 'Upload cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling upload:', error);
    res.status(500).json({ error: 'Failed to cancel upload' });
  }
};