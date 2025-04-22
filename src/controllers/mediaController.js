//src/controllers/mediaController.js
const pool = require("../config/db");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');
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
  const { contentType, filename, fileSize, memoryId, postId } = req.body;
  
  if (!contentType || !filename) {
    return res.status(400).json({ error: "Content type and filename are required" });
  }

  try {
    // Validate file size if provided
    if (fileSize) {
      const fileSizeMB = parseInt(fileSize) / (1024 * 1024);
      // Set a generous upper limit (e.g., 500MB)
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
    

    const uniqueId = crypto.randomBytes(8).toString('hex');
    const context = memoryId ? `memory_${memoryId}` : (postId ? `post_${postId}` : 'general');
    
    const key = `pending/${userId}/${Date.now()}-${uniqueId}.${fileExt}`;

    
    // Create command for presigned URL
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // Add additional metadata for tracking
      Metadata: {
        userId: userId.toString(),
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
        memoryId: memoryId ? memoryId.toString() : '',
        postId: postId ? postId.toString() : '',
        context: context
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
             (user_id, object_key, content_type, original_filename, file_url, status, 
              memory_id, post_id, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, NOW())
             RETURNING id`,
      values: [userId, key, contentType, filename, fileUrl, memoryId || null, postId || null]
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

exports.confirmUpload = async (req, res) => {
  const userId = req.user.id;
  const { uploadId, key, memoryId, postId } = req.body;
  
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
    // FIX: Corrected parameter order in the UPDATE query
    const updateQuery = {
      text: `UPDATE media_uploads 
             SET status = 'completed', updated_at = NOW(),
             memory_id = COALESCE($3, memory_id),
             post_id = COALESCE($4, post_id)
             WHERE id = $1
             RETURNING *`,
      values: [uploadId, memoryId || null, postId || null]
    };
    
    // FIX: The error occurs because we have 4 placeholders but only 3 values
    // Let's correct the values array to match the placeholders:
    const updateValues = [uploadId];
    
    // The issue is that we're trying to use $2 but it's not defined in the values array
    // Add a placeholder value for the WHERE clause (should be user_id, which isn't in the query)
    updateValues.push(memoryId || null);
    updateValues.push(postId || null);
    
    // Now execute with the correct values array
    const result = await pool.query(
      `UPDATE media_uploads 
       SET status = 'completed', updated_at = NOW(),
       memory_id = COALESCE($2, memory_id),
       post_id = COALESCE($3, post_id)
       WHERE id = $1
       RETURNING *`, 
      updateValues
    );
    
    // If this is for a memory and memoryId was provided, add to memory_content
    if (memoryId) {
      try {
        const memoryContentQuery = {
          text: `INSERT INTO memory_content 
                 (memory_id, user_id, file_path, content_type, created_at)
                 VALUES ($1, $2, $3, $4, NOW())
                 RETURNING *`,
          values: [memoryId, userId, upload.file_url, upload.content_type]
        };
        
        const memoryResult = await pool.query(memoryContentQuery);
        console.log('Added to memory_content:', memoryResult.rows[0]);
      } catch (memoryError) {
        console.error('Error adding to memory_content:', memoryError);
        // Continue anyway as the file is uploaded successfully
      }
    }
    
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
      console.log(`Successfully deleted cancelled upload: ${key}`);
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

// New method to handle cleanup of pending uploads
exports.cleanupPendingUploads = async (req, res) => {
  try {
    // Find uploads that are pending OR cancelled and not associated with posts/memories
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
    
    console.log(`Found ${rows.length} unused uploads to clean up`);
    
    let deletedCount = 0;
    let failedDeletions = [];
    
    for (const upload of rows) {
      try {
        console.log(`Attempting to delete file with key: ${upload.object_key}`);
        console.log(`File URL: ${upload.file_url}`);
        
        // Try to delete the file from R2
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: upload.object_key
        });
        
        // Wait for the delete operation to complete and log the result
        const deleteResult = await s3Client.send(deleteCommand);
        console.log(`R2 delete result for ${upload.id}:`, deleteResult);
        
        // Update the status to 'deleted' in a way that works with check constraints
        await pool.query(
          `DELETE FROM media_uploads WHERE id = $1`,
          [upload.id]
        );
        
        console.log(`Successfully deleted upload ${upload.id} from database`);
        deletedCount++;
      } catch (error) {
        console.error(`Error cleaning up upload ${upload.id}:`, error);
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
    console.error('Error in cleanup process:', error);
    res.status(500).json({ error: 'Failed to run cleanup process' });
  }
};