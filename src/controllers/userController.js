const pool = require('../config/db');
const { getSignedImageUrl } = require('../middleware/imageUpload');


exports.getUserProfile = async (req, res) => {
    const userId = req.user.id;

    try {
        // Get basic user details
        const userQuery = `
            SELECT id, name, email
            FROM users
            WHERE id = $1
        `;
        const { rows: [user] } = await pool.query(userQuery, [userId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's families
        const familiesQuery = `
            SELECT f.family_id, f.family_name
            FROM families f
            JOIN user_families uf ON f.family_id = uf.family_id
            WHERE uf.user_id = $1
        `;
        const { rows: families } = await pool.query(familiesQuery, [userId]);

        // Add families array to user object
        user.families = families;
        
        // Add primary_family_id if user has at least one family
        if (families.length > 0) {
            user.primary_family_id = families[0].family_id;
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUserProfileInFamily = async (req, res) => {
    const { userId, familyId } = req.params;
    const currentUserId = req.user.id;

    try {
        // Check if the current user is a member of the requested family
        const membershipQuery = `
            SELECT * FROM user_families WHERE user_id = $1 AND family_id = $2
        `;
        const membershipResult = await pool.query(membershipQuery, [currentUserId, familyId]);

        if (membershipResult.rows.length === 0) {
            return res.status(403).json({ error: "You are not a member of this family" });
        }

        // Check if the requested user is a member of the requested family
        const userMembershipQuery = `
            SELECT id, name, email FROM users WHERE id = $1 AND id IN (
                SELECT user_id FROM user_families WHERE family_id = $2
            )
        `;
        const userResult = await pool.query(userMembershipQuery, [userId, familyId]);

        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found in the specified family' });
        }

        // Fetch posts related to this family and user
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
            WHERE p.author_id = $1 AND p.family_id = $2
            ORDER BY p.created_at DESC
        `;
        const { rows: posts } = await pool.query(postsQuery, [userId, familyId]);

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
        console.error('Error fetching user profile in family:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
