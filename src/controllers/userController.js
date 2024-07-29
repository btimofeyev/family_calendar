const pool = require('../config/db');
const { getSignedImageUrl } = require('../middleware/imageUpload');


exports.getUserProfile = async (req, res) => {
    const userId = req.params.userId;
    const currentUserId = req.user.id;

    try {
        // Get user details
        const userQuery = `
            SELECT id, name, email, family_id
            FROM users
            WHERE id = $1 AND family_id = (SELECT family_id FROM users WHERE id = $2)
        `;
        const { rows: [user] } = await pool.query(userQuery, [userId, currentUserId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found or not in your family' });
        }

        // Get user's posts with likes, comments, and author information
        const postsQuery = `
            SELECT 
                p.*,
                u.name as author_name,
                (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) as comments_count,
                CASE WHEN EXISTS (SELECT 1 FROM likes WHERE post_id = p.post_id AND user_id = $2) THEN true ELSE false END as is_liked,
                (
                    SELECT json_agg(json_build_object('id', c.comment_id, 'text', c.text, 'author_name', cu.name, 'created_at', c.created_at))
                    FROM comments c
                    JOIN users cu ON c.author_id = cu.id
                    WHERE c.post_id = p.post_id
                ) as comments
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.author_id = $1
            ORDER BY p.created_at DESC
        `;
        const { rows: posts } = await pool.query(postsQuery, [userId, currentUserId]);

        // Generate signed URLs for each image
        const postsWithSignedUrls = await Promise.all(posts.map(async (post) => {
            if (post.image_url) {
                const key = post.image_url.split('/').pop();
                post.signed_image_url = await getSignedImageUrl(key);
            }
            return post;
        }));

        res.json({ user, posts: postsWithSignedUrls });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};