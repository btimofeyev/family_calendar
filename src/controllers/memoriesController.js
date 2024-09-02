const pool = require("../config/db");
const { deleteMediaFromS3 } = require('../middleware/imageUpload');
const { createNotification } = require('./notificationController');

exports.createMemory = async (req, res) => {
  const { familyId, title, description } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      'INSERT INTO memories (title, description, family_id, created_by) VALUES ($1, $2, $3, $4) RETURNING memory_id',
      [title, description, familyId, userId]
    );
    
    const memoryId = result.rows[0].memory_id;

    // Fetch family members to notify
    const familyMembersResult = await pool.query(
      'SELECT user_id FROM user_families WHERE family_id = $1 AND user_id != $2',
      [familyId, userId]
    );

    // Get the user's name
    const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0].name;

    // Create notifications for family members
    for (const member of familyMembersResult.rows) {
      await createNotification(
        member.user_id,
        'memory',
        `${userName} started a new memory: "${title}"`,
        null,
        null,
        familyId,
        memoryId
      );
    }

    res.status(201).json({ id: memoryId, message: 'Memory created successfully' });
  } catch (error) {
    console.error('Error creating memory:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
};

exports.getMemories = async (req, res) => {
  const { familyId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT m.*, m.created_by = $2 as is_owner,
      (SELECT ARRAY(SELECT mc.file_path 
                    FROM memory_content mc 
                    WHERE mc.memory_id = m.memory_id 
                    ORDER BY mc.created_at 
                    LIMIT 3)) as preview_images
      FROM memories m 
      JOIN user_families uf ON m.family_id = uf.family_id 
      WHERE m.family_id = $1 AND uf.user_id = $2`,
      [familyId, userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
};

exports.addContentToMemory = async (req, res) => {
  const { memoryId } = req.params;
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const file = req.file;
    // The file is already uploaded to S3 by multer-s3, so we can use the file.location
    const fileUrl = file.location;

    await pool.query(
      'INSERT INTO memory_content (memory_id, user_id, file_path, content_type) VALUES ($1, $2, $3, $4)',
      [memoryId, userId, fileUrl, file.mimetype]
    );
    res.status(201).json({ message: 'Content added to memory successfully', fileUrl });
  } catch (error) {
    console.error('Error adding content to memory:', error);
    res.status(500).json({ error: 'Failed to add content to memory' });
  }
};

exports.addCommentToMemory = async (req, res) => {
  const { memoryId } = req.params;
  const { commentText } = req.body;
  const userId = req.user.id;

  try {
    await pool.query(
      'INSERT INTO memory_comments (memory_id, user_id, comment_text) VALUES ($1, $2, $3)',
      [memoryId, userId, commentText]
    );
    res.status(201).json({ message: 'Comment added to memory successfully' });
  } catch (error) {
    console.error('Error adding comment to memory:', error);
    res.status(500).json({ error: 'Failed to add comment to memory' });
  }
};

// Add this new function to get memory content with a limit
exports.getMemoryContent = async (req, res) => {
  const { memoryId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit) : null;

  try {
    let query = 'SELECT * FROM memory_content WHERE memory_id = $1 ORDER BY created_at DESC';
    const queryParams = [memoryId];

    if (limit) {
      query += ' LIMIT $2';
      queryParams.push(limit);
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching memory content:', error);
    res.status(500).json({ error: 'Failed to fetch memory content' });
  }
};

exports.getMemoryComments = async (req, res) => {
  const { memoryId } = req.params;

  try {
    const result = await pool.query(
      'SELECT mc.*, u.name as user_name FROM memory_comments mc JOIN users u ON mc.user_id = u.id WHERE mc.memory_id = $1 ORDER BY mc.created_at DESC',
      [memoryId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching memory comments:', error);
    res.status(500).json({ error: 'Failed to fetch memory comments' });
  }
};

exports.deleteMemory = async (req, res) => {
  const { memoryId } = req.params;
  const userId = req.user.id;

  try {
    // First, check if the user is the owner of the memory
    const checkOwnerQuery = 'SELECT * FROM memories WHERE memory_id = $1 AND created_by = $2';
    const checkResult = await pool.query(checkOwnerQuery, [memoryId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have permission to delete this memory' });
    }

    // Fetch all content associated with this memory
    const contentQuery = 'SELECT file_path FROM memory_content WHERE memory_id = $1';
    const contentResult = await pool.query(contentQuery, [memoryId]);

    // Delete all content from S3
    for (const content of contentResult.rows) {
      await deleteMediaFromS3(content.file_path);
    }

    // Delete associated content and comments from the database
    await pool.query('DELETE FROM memory_content WHERE memory_id = $1', [memoryId]);
    await pool.query('DELETE FROM memory_comments WHERE memory_id = $1', [memoryId]);

    // Delete the memory itself
    await pool.query('DELETE FROM memories WHERE memory_id = $1', [memoryId]);

    res.json({ message: 'Memory and associated content deleted successfully' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
};