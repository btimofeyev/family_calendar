const pool = require('../config/db');
const { deleteImageFromS3, getSignedImageUrl } = require('../middleware/imageUpload');
const { v4: uuidv4 } = require('uuid'); 


// Get all posts for a family
exports.getPosts = async (req, res) => {
    try {
      const familyId = req.user.family_id;
      console.log('Type of familyId:', typeof familyId, 'Value:', familyId);

      const query = `
        SELECT p.*, u.name as author_name, 
               (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) as likes_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.family_id = $1
        ORDER BY p.created_at DESC
      `;
      const { rows } = await pool.query(query, [familyId]);
  
      // Generate signed URLs for each image
      const postsWithSignedUrls = await Promise.all(rows.map(async (post) => {
        if (post.image_url) {
          const key = post.image_url.split('/').pop();
          post.signed_image_url = await getSignedImageUrl(key);
        }
        return post;
      }));
  
      res.json(postsWithSignedUrls);
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// Create a new post
exports.createPost = async (req, res) => {
    const { caption } = req.body;
    const imageUrl = req.file ? req.file.location : null;
    const authorId = req.user.id;
    const familyId = req.user.family_id;

    console.log("Author ID:", authorId, "Type:", typeof authorId);
    console.log("Family ID:", familyId, "Type:", typeof familyId);

    if (!familyId) {
        return res.status(400).json({ error: 'User does not belong to a family' });
    }

    try {
        const query = `
            INSERT INTO posts (author_id, family_id, image_url, caption, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;
        const values = [authorId, familyId, imageUrl, caption];
        const { rows } = await pool.query(query, values);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating post:', error);
        if (imageUrl) {
            await deleteImageFromS3(imageUrl);
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Toggle like on a post
exports.toggleLike = async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    // Check if the like already exists
    const checkQuery = 'SELECT * FROM likes WHERE post_id = $1 AND user_id = $2';
    const { rows } = await pool.query(checkQuery, [postId, userId]);

    if (rows.length > 0) {
      // Unlike
      await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
    } else {
      // Like
      await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
    }

    // Get updated like count
    const countQuery = 'SELECT COUNT(*) as likes_count FROM likes WHERE post_id = $1';
    const { rows: countRows } = await pool.query(countQuery, [postId]);
    
    res.json({ likes_count: parseInt(countRows[0].likes_count) });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  const postId = req.params.postId;
  const authorId = req.user.id;
  const { text } = req.body;

  try {
    const query = `
      INSERT INTO comments (post_id, author_id, text, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    const { rows } = await pool.query(query, [postId, authorId, text]);
    
    // Fetch author name
    const authorQuery = 'SELECT name FROM users WHERE id = $1';
    const { rows: authorRows } = await pool.query(authorQuery, [authorId]);
    
    const comment = {
      ...rows[0],
      author_name: authorRows[0].name
    };
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get comments for a post
exports.getComments = async (req, res) => {
  const postId = req.params.postId;

  try {
    const query = `
      SELECT c.*, u.name as author_name
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `;
    const { rows } = await pool.query(query, [postId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};