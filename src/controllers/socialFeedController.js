const pool = require("../config/db");
const {
  // deleteMediaFromS3,  // Commented out S3 logic
  getSignedImageUrl,
  uploadToR2, // Replaced uploadToS3 with uploadToR2
  deleteMediaFromR2,
} = require("../middleware/imageUpload");
const { getLinkPreview } = require('link-preview-js');
const { createNotification } = require('./notificationController');
const axios = require('axios');

function isYouTubeLink(url) {
  return /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(url);
}

function isTwitterLink(url) {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//.test(url);
}

function getYouTubeVideoId(url) {
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

async function getTwitterEmbedHtml(tweetUrl) {
  try {
    const response = await axios.get(`https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`);
    console.log('Twitter/X Embed HTML:', response.data.html);  
    return response.data.html;
  } catch (error) {
    console.error('Error fetching Twitter/X embed:', error);
    return null;
  }
}

exports.getPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { familyId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const offset = (page - 1) * limit;

    // Check if the user is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [userId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    // Get total count of posts
    const countQuery = "SELECT COUNT(*) FROM posts WHERE family_id = $1";
    const { rows: countRows } = await pool.query(countQuery, [familyId]);
    const totalPosts = parseInt(countRows[0].count);

    const query = `
      SELECT p.*, u.name as author_name,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comments_count,
        CASE WHEN p.author_id = $2 THEN true ELSE false END as is_owner
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.family_id = $1
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const { rows } = await pool.query(query, [familyId, userId, limit, offset]);

    const postsWithSignedUrls = await Promise.all(
      rows.map(async (post) => {
        if (post.image_url) {
          const key = post.image_url.split("/").pop();
          const signedImageUrl = await getSignedImageUrl(key);
          // Use custom domain for production, else use the direct R2 bucket URL for development
          const baseUrl = process.env.NODE_ENV === 'production' ? process.env.R2_CUSTOM_DOMAIN : process.env.R2_BUCKET_URL;
          post.signed_image_url = `${baseUrl}/${key}`;
        }
        if (typeof post.link_preview === 'string') {
          try {
            post.link_preview = JSON.parse(post.link_preview);
          } catch (error) {
            console.error('Error parsing link preview JSON:', error);
            post.link_preview = null;
          }
        }
        return post;
      })
    );
    

    res.json({
      posts: postsWithSignedUrls,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit),
      totalPosts: totalPosts
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a new post
exports.createPost = async (req, res) => {
  const { caption, familyId } = req.body;
  const file = req.file;
  const authorId = req.user.id;

  let mediaUrl = null;
  let mediaType = null;

  try {
    // Check if the user is a member of the family
    const checkMembershipQuery = {
      text: "SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2",
      values: [authorId, familyId],
    };
    const membershipResult = await pool.query(checkMembershipQuery);

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: "You are not a member of this family" });
    }

    if (file) {
      mediaUrl = await uploadToR2(file);  // Replaced uploadToS3 with uploadToR2
      mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
    }

    let linkPreview = null;
    const urls = extractUrls(caption);
    if (urls.length > 0) {
      const url = urls[0];
      if (isYouTubeLink(url)) {
        const videoId = getYouTubeVideoId(url);
        linkPreview = JSON.stringify({
          title: "YouTube Video",
          description: "Click to watch on YouTube",
          image: `https://img.youtube.com/vi/${videoId}/0.jpg`,
          url: url
        });
      } else if (isTwitterLink(url)) {
        const twitterEmbedHtml = await getTwitterEmbedHtml(url);
        if (twitterEmbedHtml) {
          linkPreview = JSON.stringify({
            type: 'twitter',
            html: twitterEmbedHtml,
            url: url
          });
          console.log('Twitter Link Preview:', linkPreview);  
          linkPreview = JSON.stringify({
            type: 'link',
            title: 'Twitter Post',
            description: 'View this post on Twitter',
            url: url
          });
        }
      } else {
        try {
          const preview = await getLinkPreview(url, {
            timeout: 3000,
            followRedirects: 'follow',
          });
          linkPreview = JSON.stringify({
            title: preview.title || '',
            description: preview.description || '',
            image: preview.images && preview.images.length > 0 ? preview.images[0] : '',
            url: preview.url || url
          });
        } catch (previewError) {
          console.error('Error fetching link preview:', previewError);
          // Fallback to a basic preview if fetching fails
          linkPreview = JSON.stringify({
            title: 'Link',
            description: 'Visit the link for more information',
            image: '',
            url: url
          });
        }
      }
    }

    const query = `
      INSERT INTO posts (author_id, family_id, media_url, media_type, caption, link_preview, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    const values = [authorId, familyId, mediaUrl, mediaType, caption, linkPreview];
    const { rows } = await pool.query(query, values);

    // Fetch author name
    const authorQuery = 'SELECT name FROM users WHERE id = $1';
    const { rows: authorRows } = await pool.query(authorQuery, [authorId]);

    const post = {
      ...rows[0],
      author_name: authorRows[0].name,
      link_preview: linkPreview ? JSON.parse(linkPreview) : null
    };

    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    // if (mediaUrl) { // Commented out since we're not deleting from S3 anymore
    //   await deleteMediaFromS3(mediaUrl);
    // }
    res.status(500).json({ error: 'Internal server error' });
  }
};

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// Delete post
exports.deletePost = async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    // Fetch the post to check if it exists and belongs to the user
    const fetchQuery = "SELECT * FROM posts WHERE post_id = $1";
    const { rows } = await pool.query(fetchQuery, [postId]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Post not found",
      });
    }

    const post = rows[0];

    // Check if the user is the author of the post
    if (post.author_id !== userId) {
      return res.status(403).json({
        error: "You do not have permission to delete this post",
      });
    }

    // Delete the post from the database
    const deleteQuery = "DELETE FROM posts WHERE post_id = $1";
    await pool.query(deleteQuery, [postId]);

    // If the post has media, delete it from R2
    if (post.media_url) {
      // Replace delete logic for R2 if needed, currently commented out
      // await deleteMediaFromR2(post.media_url);
      await deleteMediaFromR2(post.media_url);
    }

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Toggle like on a post
exports.toggleLike = async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    // Check if the like already exists
    const checkQuery = "SELECT * FROM likes WHERE post_id = $1 AND user_id = $2";
    const { rows } = await pool.query(checkQuery, [postId, userId]);

    let action;
    if (rows.length > 0) {
      // Unlike
      await pool.query("DELETE FROM likes WHERE post_id = $1 AND user_id = $2", [postId, userId]);
      action = 'unliked';
    } else {
      // Like
      await pool.query("INSERT INTO likes (post_id, user_id) VALUES ($1, $2)", [postId, userId]);
      action = 'liked';

      // Fetch post author, user name, and family ID
      const postQuery = "SELECT p.author_id, p.family_id, u.name AS liker_name FROM posts p JOIN users u ON u.id = $2 WHERE p.post_id = $1";
      const { rows: postRows } = await pool.query(postQuery, [postId, userId]);

      if (postRows.length > 0) {
        const authorId = postRows[0].author_id;
        const familyId = postRows[0].family_id;  // Get the family ID
        const likerName = postRows[0].liker_name;
        await createNotification(authorId, 'like', `${likerName} liked your post`, postId, null, familyId);  // Pass familyId here
      }
    }

    // Get updated like count
    const countQuery = "SELECT COUNT(*) as likes_count FROM likes WHERE post_id = $1";
    const { rows: countRows } = await pool.query(countQuery, [postId]);

    res.json({ likes_count: parseInt(countRows[0].likes_count), action });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  const postId = req.params.postId;
  const authorId = req.user.id;
  const { text, parentCommentId } = req.body;

  try {
    const query = `
      INSERT INTO comments (post_id, author_id, text, parent_comment_id, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    const { rows } = await pool.query(query, [postId, authorId, text, parentCommentId]);

    // Fetch author name, post author, parent comment author, and family ID
    const authorQuery = `
      SELECT c.*, u.name as author_name, p.author_id as post_author_id, p.family_id,
             CASE WHEN c.parent_comment_id IS NOT NULL THEN
               (SELECT author_id FROM comments WHERE comment_id = c.parent_comment_id)
             ELSE NULL END as parent_comment_author_id
      FROM comments c
      JOIN users u ON c.author_id = u.id
      JOIN posts p ON c.post_id = p.post_id
      WHERE c.comment_id = $1
    `;
    const { rows: authorRows } = await pool.query(authorQuery, [rows[0].comment_id]);

    const comment = authorRows[0];

    // Create notification for the post author (if the commenter is not the post author)
    if (comment.post_author_id !== authorId) {
      await createNotification(comment.post_author_id, 'comment', `${comment.author_name} commented on your post`, postId, comment.comment_id, comment.family_id);  // Pass familyId here
    }

    // If it's a reply, create notification for the parent comment author
    if (comment.parent_comment_author_id && comment.parent_comment_author_id !== authorId) {
      await createNotification(comment.parent_comment_author_id, 'reply', `${comment.author_name} replied to your comment`, postId, comment.comment_id, comment.family_id);  // Pass familyId here
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Internal server error" });
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
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get link preview
exports.getLinkPreview = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const preview = await getLinkPreview(url);
    res.json({
      title: preview.title,
      description: preview.description,
      image: preview.images[0] || '',  
      url: preview.url
    });
  } catch (error) {
    console.error('Error fetching link preview:', error);
    res.status(500).json({ error: 'Failed to fetch link preview' });
  }
};
