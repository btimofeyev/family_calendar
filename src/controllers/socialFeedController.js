const pool = require("../config/db");
const {
  getSignedImageUrl,
  uploadToR2,
  deleteMediaFromR2,
  promotePendingToComplete,
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
    const userId   = req.user.id;
    const familyId = req.params.familyId;
    const page     = parseInt(req.query.page ?? '1', 10) || 1;
    const limit    = 10;
    const offset   = (page - 1) * limit;

    /* 1 ─ membership check */
    const { rowCount } = await pool.query(
      'SELECT 1 FROM user_families WHERE user_id=$1 AND family_id=$2',
      [userId, familyId]
    );
    if (!rowCount) {
      return res.status(403).json({ error: 'You are not a member of this family' });
    }

    /* 2 ─ total count (for pagination) */
    const { rows:[{ count: total }] } = await pool.query(
      'SELECT COUNT(*) FROM posts WHERE family_id=$1',
      [familyId]
    );

    /* 3 ─ fetch the page */
    const { rows: posts } = await pool.query(`
      SELECT p.*,
             u.name                                         AS author_name,
             (SELECT COUNT(*) FROM likes    WHERE post_id=p.post_id) AS likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id=p.post_id) AS comments_count,
             (p.author_id = $2)                             AS is_owner
        FROM posts p
        JOIN users u ON u.id = p.author_id
       WHERE p.family_id = $1
       ORDER BY p.created_at DESC
       LIMIT $3 OFFSET $4`,
      [familyId, userId, limit, offset]
    );

    /* 4 ─ light post‑processing  (no URL rewriting!) */
    const parsed = posts.map(p => {
      // ensure link_preview is an object, not raw JSON
      if (typeof p.link_preview === 'string') {
        try   { p.link_preview = JSON.parse(p.link_preview); }
        catch { p.link_preview = null; }
      }
      // keep the exact URLs the DB has – frontend already knows how to render them
      return p;
    });

    /* 5 ─ reply */
    res.json({
      posts      : parsed,
      currentPage: page,
      totalPages : Math.ceil(total / limit),
      totalPosts : parseInt(total, 10)
    });

  } catch (err) {
    console.error('getPosts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.getPost = async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    // Fetch the post
    const fetchQuery = `
      SELECT 
        p.*,
        u.name as author_name,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comments_count,
        CASE WHEN EXISTS (SELECT 1 FROM likes WHERE post_id = p.post_id AND user_id = $2) THEN true ELSE false END as is_liked,
        (p.author_id = $2) as is_owner
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.post_id = $1
    `;
    
    const { rows } = await pool.query(fetchQuery, [postId, userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: "Post not found",
      });
    }

    const post = rows[0];
    
    // Ensure link_preview is parsed
    if (typeof post.link_preview === 'string') {
      try {
        post.link_preview = JSON.parse(post.link_preview);
      } catch (e) {
        post.link_preview = null;
      }
    }
    
    // Check if user has permission to view this post
    const familyCheckQuery = {
      text: `SELECT 1 FROM user_families 
             WHERE user_id = $1 AND family_id = $2`,
      values: [userId, post.family_id],
    };
    
    const familyResult = await pool.query(familyCheckQuery);
    
    if (familyResult.rows.length === 0) {
      return res.status(403).json({ 
        error: "You do not have permission to view this post" 
      });
    }
    
    res.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
exports.updatePost = async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;
  const { caption, media = [] } = req.body;

  try {
    // Check if the post exists and belongs to the user
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
        error: "You do not have permission to edit this post",
      });
    }

    // Update the post with the new fields
    let mediaUrls = post.media_urls || [];
    let mediaType = post.media_type;
    
    // Handle the media URLs based on request
    if (req.body.replaceAllMedia === true) {
      // Replace all media - discard existing media URLs
      mediaUrls = [];
    } else if (req.body.removeMediaUrls && Array.isArray(req.body.removeMediaUrls)) {
      // Filter out specific media URLs that need to be removed
      mediaUrls = mediaUrls.filter(url => !req.body.removeMediaUrls.includes(url));
    }
    
    // If there are new media items
    if (media && Array.isArray(media) && media.length > 0) {
      // Process any new media items - convert pending URLs to complete URLs
      // Filter out items with missing URLs first
      const validMediaItems = media.filter(item => item && item.url);
      
      // Now process only the valid items
      const promoted = validMediaItems.map(item => {
        try {
          const promotedItem = promotePendingToComplete(item.url);
          return {
            ...promotedItem,
            uploadId: item.uploadId ?? null,
            type: item.type || 'image'
          };
        } catch (error) {
          console.error(`Error promoting URL ${item.url}:`, error);
          // Return a simple object with the original URL if promotion fails
          return {
            url: item.url,
            oldKey: item.url,
            newKey: item.url,
            uploadId: item.uploadId ?? null,
            type: item.type || 'image'
          };
        }
      });
      
      // Add new media URLs to existing ones
      const newMediaUrls = promoted.map(m => m.url).filter(url => url);
      mediaUrls = [...mediaUrls, ...newMediaUrls];
      
      // Make sure we don't have duplicate URLs and filter out empty URLs
      mediaUrls = [...new Set(mediaUrls.filter(url => url && url.trim() !== ''))];
      
      // Update media type if needed (if we're adding a video)
      if (mediaType !== 'video' && 
          promoted.some(m => m.type === 'video' || 
                            (m.url && typeof m.url === 'string' && 
                             m.url.toLowerCase().match(/\.(mp4|mov|avi)$/)))) {
        mediaType = 'video';
      } else if (!mediaType && mediaUrls.length > 0) {
        mediaType = 'image';
      }
      
      // Update the media_uploads records to link them to this post
      for (const m of promoted) {
        if (!m.uploadId && (!m.oldKey || m.oldKey === m.url)) {
          // Skip items that don't need database updates
          continue;
        }
        
        try {
          const sql = m.uploadId
            ? `UPDATE media_uploads
                  SET post_id=$2,
                      object_key=$3,
                      file_url=$4,
                      status='completed',
                      updated_at=NOW()
                WHERE id=$1`
            : `UPDATE media_uploads
                  SET post_id=$3,
                      object_key=$2,
                      file_url=$4,
                      status='completed',
                      updated_at=NOW()
                WHERE object_key=$1`;
        
          const params = m.uploadId
            ? [m.uploadId, postId, m.newKey || m.oldKey, m.url]
            : [m.oldKey, m.newKey || m.oldKey, postId, m.url];
        
          await pool.query(sql, params);
        } catch (dbError) {
          console.error('Error updating media_uploads:', dbError);
          // Continue with other updates even if one fails
        }
      }
    }
    
    // Update the post in the database
    const updateQuery = {
      text: `UPDATE posts
             SET caption = COALESCE($1, caption),
                 media_urls = $2,
                 media_type = $3,
                 updated_at = NOW()
             WHERE post_id = $4
             RETURNING *`,
      values: [
        caption !== undefined ? caption : post.caption,
        mediaUrls,
        mediaType,
        postId
      ],
    };
    
    const updateResult = await pool.query(updateQuery);
    const updatedPost = updateResult.rows[0];
    
    // Fetch author name to include in response
    const authorQuery = "SELECT name FROM users WHERE id = $1";
    const authorResult = await pool.query(authorQuery, [userId]);
    
    // Prepare response
    res.status(200).json({
      ...updatedPost,
      author_name: authorResult.rows[0].name
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// Create a new post - Updated for multiple media
exports.createPost = async (req, res) => {
  const familyId = req.params.familyId || req.body.familyId;
  const { caption = '' } = req.body;
  const files     = req.files ?? [];          
  const authorId  = req.user.id;

  const mediaInfo = [];                      
  let   mediaType = null;
  let   linkPreview = null;

  try {
    /* 0 ─ Membership check -------------------------------------------------- */
    const { rowCount } = await pool.query(
      "SELECT 1 FROM user_families WHERE user_id=$1 AND family_id=$2",
      [authorId, familyId]
    );
    if (!rowCount) {
      return res.status(403).json({ error: 'You are not a member of this family' });
    }

    /* 1 ─ Upload each file -> promote -> collect final URLs ----------------- */
    for (const file of files.slice(0, 4)) {            // max 4 files
      const pendingUrl  = await uploadToR2(file);      // pending/…
      const { url, oldKey, newKey } = promotePendingToComplete(pendingUrl);
      mediaInfo.push({ url, oldKey, newKey });
    }

    if (mediaInfo.length) {
      mediaType = files[0].mimetype.startsWith('image/') ? 'image' : 'video';
    }

    /* 2 ─ Build link preview (if caption contains URL) ---------------------- */
    const urlsInText = extractUrls(caption);
    if (urlsInText.length) {
      const url = urlsInText[0];

      if (isYouTubeLink(url)) {                               // ─ YouTube
        const vid = getYouTubeVideoId(url);
        linkPreview = {
          title      : 'YouTube Video',
          description: 'Click to watch on YouTube',
          image      : `https://img.youtube.com/vi/${vid}/0.jpg`,
          url
        };

      } else if (isTwitterLink(url)) {                        // ─ Twitter / X
        const embed = await getTwitterEmbedHtml(url);
        linkPreview = embed
          ? { type: 'twitter', html: embed, url }
          : { type: 'link', title: 'Twitter Post', description: 'View on Twitter', url };

      } else {                                                // ─ Generic link
        try {
          const prev = await getLinkPreview(url, { timeout: 3000, followRedirects: 'follow' });
          linkPreview = {
            title      : prev.title || 'Link',
            description: prev.description || '',
            image      : prev.images?.[0] || '',
            url        : prev.url || url
          };
        } catch (_) {
          linkPreview = { title: 'Link', description: 'Visit for more information', image: '', url };
        }
      }
    }

    /* 3 ─ Insert the post --------------------------------------------------- */
    const { rows } = await pool.query(`
        INSERT INTO posts
          (author_id, family_id, media_urls, media_type, caption, link_preview, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,NOW())
        RETURNING *`,
      [
        authorId,
        familyId,
        mediaInfo.map(m => m.url),         // array of urls (may be empty)
        mediaType,
        caption,
        linkPreview ? JSON.stringify(linkPreview) : null
      ]
    );
    const newPost = rows[0];

    /* 4 ─ Mark each upload row as attached ---------------------------------- */
    for (const m of mediaInfo) {
      await pool.query(
        `UPDATE media_uploads
            SET post_id   = $3,
                object_key= $2,
                file_url  = $4,
                status    = 'completed',
                updated_at= NOW()
          WHERE object_key = $1`,
        [m.oldKey, m.newKey, newPost.post_id, m.url]
      );
    }

    /* 5 ─ Respond ----------------------------------------------------------- */
    const { rows: userRows } = await pool.query('SELECT name FROM users WHERE id=$1', [authorId]);
    res.status(201).json({
      ...newPost,
      author_name : userRows[0].name,
      link_preview: linkPreview
    });

  } catch (err) {
    console.error('createPost error:', err);
    // tidy up uploaded files if DB insert failed
    for (const { url } of mediaInfo) await deleteMediaFromR2(url).catch(()=>{});
    res.status(500).json({ error: 'Internal server error' });
  }
};
exports.createPostWithMedia = async (req, res) => {
  const familyId               = req.params.familyId || req.body.familyId;
  const { caption, media = [] } = req.body;            // media[] from mobile
  const authorId               = req.user.id;

  try {
    /* 0 ─ membership */
    const { rowCount } = await pool.query(
      "SELECT 1 FROM user_families WHERE user_id=$1 AND family_id=$2",
      [authorId, familyId]
    );
    if (!rowCount) return res.status(403).json({ error: "Not in family" });

    /* 1 ─ promote each pending URL asynchronously */
    const promoted = media.map(item => ({
      ...promotePendingToComplete(item.url),  // returns {url,key}
      uploadId : item.uploadId ?? null,
      type     : item.type
    }));

    const mediaUrls = promoted.map(m => m.url);
    const mediaType = promoted.some(m => m.type === "video") ? "video"
                    : mediaUrls.length                       ? "image"
                    : null;

    /* 2 ─ insert post */
    const { rows:[post] } = await pool.query(
      `INSERT INTO posts
         (author_id,family_id,media_urls,media_type,caption,created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       RETURNING *`,
      [authorId, familyId, mediaUrls, mediaType, caption]
    );

    /* 3 ─ stitch media_uploads → post */
    for (const m of promoted) {
      const sql = m.uploadId
          ? `UPDATE media_uploads
                SET post_id=$2,
                    object_key=$3,
                    file_url=$4,
                    status='completed',
                    updated_at=NOW()
              WHERE id=$1`
          : `UPDATE media_uploads
                SET post_id=$3,
                    object_key=$2,
                    file_url=$4,
                    status='completed',
                    updated_at=NOW()
              WHERE object_key=$1`;
    
      const params = m.uploadId
          ? [m.uploadId, post.post_id, m.newKey, m.url]
          : [m.oldKey   , m.newKey   , post.post_id, m.url];
    
      await pool.query(sql, params);
    
    }

    /* 4 ─ respond */
    const { rows:[u] } = await pool.query("SELECT name FROM users WHERE id=$1",[authorId]);
    res.status(201).json({ ...post, author_name: u.name });
  } catch (err) {
    console.error("createPostWithMedia error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text ? (text.match(urlRegex) || []) : [];
}

// Delete post - Updated to handle multiple media URLs
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

    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete likes and comments first (foreign key constraints)
      await client.query("DELETE FROM likes WHERE post_id = $1", [postId]);
      await client.query("DELETE FROM comments WHERE post_id = $1", [postId]);
      
      // Delete or update all associated media_uploads records
      // This is the key change - update ALL media uploads for this post, regardless of status
      await client.query(
        "DELETE FROM media_uploads WHERE post_id = $1",
        [postId]
      );
      
      // Delete the post from the database
      await client.query("DELETE FROM posts WHERE post_id = $1", [postId]);
      
      // Commit transaction
      await client.query('COMMIT');
      
      // If the post has media, delete all media from R2
      // This happens outside the transaction as S3 operations can't be rolled back
      if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
        console.log(`Deleting ${post.media_urls.length} media files for post ${postId}`);
        
        for (const mediaUrl of post.media_urls) {
          if (mediaUrl) {
            try {
              await deleteMediaFromR2(mediaUrl);
              console.log(`Successfully deleted media: ${mediaUrl}`);
            } catch (deleteError) {
              console.error(`Error deleting media ${mediaUrl}:`, deleteError);
              // Continue with other media deletions even if one fails
            }
          }
        }
      } 
      // For backward compatibility
      else if (post.media_url) {
        try {
          await deleteMediaFromR2(post.media_url);
          console.log(`Successfully deleted media: ${post.media_url}`);
        } catch (deleteError) {
          console.error(`Error deleting media ${post.media_url}:`, deleteError);
        }
      }

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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